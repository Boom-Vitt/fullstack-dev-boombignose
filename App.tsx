/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppStatus, ChatMessage, ManualRecord, AuthUser, StoredMessage } from './types';
import * as geminiService from './services/geminiService';
import { apiClient } from './services/apiClient';
import Spinner from './components/Spinner';
import UploadPage from './components/WelcomeScreen';
import ProgressBar from './components/ProgressBar';
import ChatInterface from './components/ChatInterface';

const mapStoredMessages = (messages: StoredMessage[]): ChatMessage[] =>
    messages.map(msg => ({
        role: msg.role === 'USER' ? 'user' : 'model',
        parts: [{ text: msg.content }],
        groundingChunks: msg.grounding,
    }));

const App: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.Initializing);
    const [user, setUser] = useState<AuthUser | null>(null);
    const [manuals, setManuals] = useState<ManualRecord[]>([]);
    const [selectedManual, setSelectedManual] = useState<ManualRecord | null>(null);
    const [activePage, setActivePage] = useState<'chat' | 'upload'>('chat');
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [authError, setAuthError] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [files, setFiles] = useState<File[]>([]);
    const [manualTitle, setManualTitle] = useState('');
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number, message?: string, fileName?: string } | null>(null);
    const [activeRagStoreName, setActiveRagStoreName] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQueryLoading, setIsQueryLoading] = useState(false);
    const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
    const [documentName, setDocumentName] = useState<string>('');
    const [chatSessionId, setChatSessionId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const hasGeminiApiKey = Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY);

    const handleError = useCallback((message: string, err: any) => {
        console.error(message, err);
        setError(`${message}${err ? `: ${err instanceof Error ? err.message : String(err)}` : ''}`);
        setStatus(AppStatus.Error);
    }, []);

    const clearError = () => {
        setError(null);
        setStatus(user ? AppStatus.SelectManual : AppStatus.Auth);
    };

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const current = await apiClient.currentUser();
                setUser(current);
                setStatus(AppStatus.SelectManual);
            } catch {
                setStatus(AppStatus.Auth);
            }
        };
        fetchUser();
    }, []);

    const loadManuals = useCallback(async () => {
        try {
            const data = await apiClient.listManuals();
            setManuals(data);
        } catch (err) {
            console.error('Failed to load manuals', err);
        }
    }, []);

    useEffect(() => {
        if (user) {
            loadManuals();
        }
    }, [user, loadManuals]);

    const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const email = String(formData.get('email') || '').trim();
        const password = String(formData.get('password') || '');

        if (!email || !password) {
            setAuthError('Email and password are required.');
            return;
        }

        setAuthLoading(true);
        setAuthError(null);
        try {
            const authFn = authMode === 'login' ? apiClient.login : apiClient.signup;
            const authenticatedUser = await authFn({ email, password });
            setUser(authenticatedUser);
            setStatus(AppStatus.SelectManual);
            setActivePage('chat');
            await loadManuals();
            event.currentTarget.reset();
        } catch (err) {
            console.error('Authentication failed', err);
            setAuthError(err instanceof Error ? err.message : 'Unable to authenticate.');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await apiClient.logout();
        } catch (err) {
            console.error('Failed to log out', err);
        } finally {
            setUser(null);
            setManuals([]);
            setSelectedManual(null);
            setChatSessionId(null);
            setChatHistory([]);
            setActiveRagStoreName(null);
            setManualTitle('');
            setFiles([]);
            setStatus(AppStatus.Auth);
        }
    };

    const createChatSession = useCallback(async (manualId: string) => {
        const chat = await apiClient.createChat(manualId);
        setChatSessionId(chat.id);
        return chat;
    }, []);

    const startChatWithManual = useCallback(async (manual: ManualRecord) => {
        if (!hasGeminiApiKey) {
            handleError("Gemini API key is missing. Set GEMINI_API_KEY in .env.local.", new Error("Missing GEMINI_API_KEY"));
            return;
        }

        try {
            geminiService.initialize();
        } catch (err) {
            handleError("Initialization failed. Please select a valid API Key.", err);
            return;
        }

        setActivePage('chat');
        setSelectedManual(manual);
        setDocumentName(manual.documentName || manual.title);
        setActiveRagStoreName(manual.ragStoreName);
        setChatHistory([]);
        setExampleQuestions([]);
        setIsQueryLoading(false);
        setStatus(AppStatus.Chatting);

        try {
            const chat = await createChatSession(manual.id);
            const storedMessages = await apiClient.listMessages(chat.id);
            if (storedMessages.length) {
                setChatHistory(mapStoredMessages(storedMessages));
            }
        } catch (err) {
            handleError("Failed to start chat session", err);
            return;
        }

        try {
            const questions = await geminiService.generateExampleQuestions(manual.ragStoreName);
            setExampleQuestions(questions);
        } catch (err) {
            console.warn('Unable to fetch example questions', err);
        }
    }, [createChatSession, handleError, hasGeminiApiKey]);

    const handleUploadManual = async (title: string) => {
        if (!user) {
            setStatus(AppStatus.Auth);
            throw new Error("Please log in before uploading.");
        }
        if (!hasGeminiApiKey) {
            throw new Error("Gemini API key is required. Set GEMINI_API_KEY in .env.local.");
        }
        if (files.length === 0) {
            throw new Error("Please choose at least one file.");
        }
        if (!title.trim()) {
            throw new Error("Manual name is required.");
        }

        try {
            geminiService.initialize();
        } catch (err) {
            handleError("Initialization failed. Please select a valid API Key.", err);
            throw err;
        }

        setStatus(AppStatus.Uploading);
        const totalSteps = files.length + 2;
        setUploadProgress({ current: 0, total: totalSteps, message: "Creating document index..." });

        try {
            const storeName = `manual-${Date.now()}`;
            const ragStoreName = await geminiService.createRagStore(storeName);

            setUploadProgress({ current: 1, total: totalSteps, message: "Generating embeddings..." });

            for (let i = 0; i < files.length; i++) {
                setUploadProgress(prev => ({
                    ...(prev!),
                    current: i + 1,
                    message: "Generating embeddings...",
                    fileName: `(${i + 1}/${files.length}) ${files[i].name}`
                }));
                await geminiService.uploadToRagStore(ragStoreName, files[i]);
            }

            const manual = await apiClient.createManual({
                title: title.trim(),
                description: files.map(file => file.name).join(', '),
                mimeType: files[0]?.type,
                ragStoreName,
                documentName: files.length === 1 ? files[0].name : `${files.length} documents`,
            });
            setManuals(prev => [manual, ...prev.filter(m => m.id !== manual.id)]);
            setUploadProgress({ current: totalSteps, total: totalSteps, message: "All set!", fileName: "" });
            await new Promise(resolve => setTimeout(resolve, 400));
            setFiles([]);
            setManualTitle('');
            await loadManuals();
            setActivePage('chat');
            setStatus(AppStatus.SelectManual);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (errorMessage.includes('api key not valid') || errorMessage.includes('requested entity was not found')) {
                handleError("Gemini API key is invalid. Update GEMINI_API_KEY in .env.local and restart.", err);
            } else {
                handleError("Failed to upload manual", err);
            }
            throw err;
        } finally {
            setUploadProgress(null);
        }
    };

    const handleRestartChat = () => {
        if (selectedManual) {
            startChatWithManual(selectedManual);
        } else {
            setChatHistory([]);
            setStatus(AppStatus.SelectManual);
        }
    };

    const persistMessage = useCallback(async (role: 'USER' | 'ASSISTANT', content: string, grounding?: any) => {
        if (!chatSessionId) return;
        try {
            await apiClient.appendMessage(chatSessionId, { role, content, grounding });
        } catch (err) {
            console.error('Failed to persist message', err);
        }
    }, [chatSessionId]);

    const handleSendMessage = async (message: string) => {
        if (!activeRagStoreName) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
        setChatHistory(prev => [...prev, userMessage]);
        setIsQueryLoading(true);
        await persistMessage('USER', message);

        try {
            const result = await geminiService.fileSearch(activeRagStoreName, message);
            const modelMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: result.text }],
                groundingChunks: result.groundingChunks
            };
            setChatHistory(prev => [...prev, modelMessage]);
            await persistMessage('ASSISTANT', result.text, result.groundingChunks);
        } catch (err) {
            const errorMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: "Sorry, I encountered an error. Please try again." }]
            };
            setChatHistory(prev => [...prev, errorMessage]);
            handleError("Failed to get response", err);
        } finally {
            setIsQueryLoading(false);
        }
    };

    const renderAuth = () => (
        <div className="flex items-center justify-center min-h-screen bg-gem-onyx px-4">
            <form onSubmit={handleAuthSubmit} className="bg-gem-slate rounded-xl shadow-2xl p-8 w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-3xl font-bold mb-2">{authMode === 'login' ? 'Welcome Back' : 'Create an account'}</h1>
                    <p className="text-gem-offwhite/70">Sign {authMode === 'login' ? 'in' : 'up'} to talk to your manuals.</p>
                </div>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold mb-1" htmlFor="auth-email">Email</label>
                        <input id="auth-email" name="email" type="email" className="w-full rounded-lg px-4 py-2 bg-gem-mist border border-gem-mist/60 focus:ring-2 focus:ring-gem-blue focus:outline-none" placeholder="you@example.com" required />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold mb-1" htmlFor="auth-password">Password</label>
                        <input id="auth-password" name="password" type="password" className="w-full rounded-lg px-4 py-2 bg-gem-mist border border-gem-mist/60 focus:ring-2 focus:ring-gem-blue focus:outline-none" placeholder="••••••••" required minLength={8} />
                    </div>
                </div>
                {authError && <p className="text-red-500 text-sm">{authError}</p>}
                <button type="submit" disabled={authLoading} className="w-full bg-gem-blue hover:bg-blue-500 text-white font-semibold rounded-lg py-3 transition-colors disabled:bg-gem-mist/50 disabled:cursor-not-allowed">
                    {authLoading ? 'Please wait...' : authMode === 'login' ? 'Log in' : 'Sign up'}
                </button>
                <p className="text-center text-sm text-gem-offwhite/70">
                    {authMode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
                    <button type="button" className="text-gem-blue hover:underline" onClick={() => setAuthMode(prev => prev === 'login' ? 'signup' : 'login')}>
                        {authMode === 'login' ? 'Sign up' : 'Log in'}
                    </button>
                </p>
            </form>
        </div>
    );

    const renderHeader = () => (
        <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between px-6 py-4 border-b border-gem-mist/30 bg-gem-slate/30">
            <div>
                <p className="text-sm text-gem-offwhite/60">Talking to Documents</p>
                <h1 className="text-2xl font-bold">Select a manual or upload a new one</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-full bg-gem-mist/40 p-1">
                    <button
                        onClick={() => setActivePage('chat')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${activePage === 'chat' ? 'bg-gem-blue text-white' : 'text-gem-offwhite/80'}`}
                    >
                        Chat
                    </button>
                    <button
                        onClick={() => setActivePage('upload')}
                        className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${activePage === 'upload' ? 'bg-gem-blue text-white' : 'text-gem-offwhite/80'}`}
                    >
                        Upload
                    </button>
                </div>
                <div
                    className={`text-sm px-3 py-1 rounded-full ${hasGeminiApiKey ? 'bg-emerald-400/10 text-emerald-300 border border-emerald-400/30' : 'bg-red-500/10 text-red-300 border border-red-500/30'}`}
                >
                    {hasGeminiApiKey ? 'GEMINI_API_KEY loaded' : 'Set GEMINI_API_KEY in .env.local'}
                </div>
                <div className="text-sm text-gem-offwhite/80 px-3 py-1 rounded-full bg-gem-mist/20">{user?.email}</div>
                <button onClick={handleLogout} className="px-4 py-2 rounded-full bg-gem-mist hover:bg-gem-mist/70 text-sm font-semibold transition-colors">
                    Logout
                </button>
            </div>
        </header>
    );

    const renderManualSidebar = () => (
        <aside className="w-full max-w-sm border-r border-gem-mist/30 h-full flex flex-col bg-gem-slate/10">
            <div className="p-4 border-b border-gem-mist/20 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Your Manuals</h2>
                <button onClick={loadManuals} className="text-sm text-gem-blue hover:underline">Refresh</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {manuals.length === 0 ? (
                    <p className="text-sm text-gem-offwhite/60">
                        No manuals yet. Switch to the Upload tab to add your first file.
                    </p>
                ) : manuals.map(manual => (
                    <button
                        key={manual.id}
                        onClick={() => startChatWithManual(manual)}
                        className={`w-full text-left p-4 rounded-xl border transition-colors ${
                            selectedManual?.id === manual.id ? 'border-gem-blue bg-gem-blue/10' : 'border-gem-mist/30 hover:border-gem-blue/50'
                        }`}
                    >
                        <p className="font-semibold">{manual.title}</p>
                        {manual.description && <p className="text-sm text-gem-offwhite/60 truncate">{manual.description}</p>}
                    </button>
                ))}
            </div>
        </aside>
    );

    const renderChatArea = () => {
        if (status === AppStatus.Chatting && selectedManual && activeRagStoreName) {
            return (
                <ChatInterface
                    documentName={documentName || selectedManual.title}
                    history={chatHistory}
                    isQueryLoading={isQueryLoading}
                    onSendMessage={handleSendMessage}
                    onNewChat={handleRestartChat}
                    exampleQuestions={exampleQuestions}
                />
            );
        }

        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center max-w-md">
                    <h2 className="text-2xl font-semibold mb-3">Select a manual to begin</h2>
                    <p className="text-gem-offwhite/70">Choose one of your uploaded manuals from the list or upload a new document on the Upload tab.</p>
                </div>
            </div>
        );
    };

    const renderMain = () => (
        <div className="flex flex-col h-screen bg-gem-onyx text-gem-offwhite">
            {renderHeader()}
            <div className="flex flex-1">
                {activePage === 'upload' ? (
                    <div className="flex-1 overflow-y-auto">
                        <UploadPage
                            onUpload={handleUploadManual}
                            files={files}
                            setFiles={setFiles}
                            manualTitle={manualTitle}
                            setManualTitle={setManualTitle}
                            geminiKeyAvailable={hasGeminiApiKey}
                        />
                    </div>
                ) : (
                    <>
                        {renderManualSidebar()}
                        <section className="flex-1 relative">
                            {renderChatArea()}
                        </section>
                    </>
                )}
            </div>
        </div>
    );

    if (status === AppStatus.Initializing) {
        return (
            <main className="h-screen bg-gem-onyx text-gem-offwhite flex items-center justify-center">
                <Spinner /> <span className="ml-4 text-xl">Initializing...</span>
            </main>
        );
    }

    if (!user || status === AppStatus.Auth) {
        return <main className="bg-gem-onyx">{renderAuth()}</main>;
    }

    if (status === AppStatus.Uploading && uploadProgress) {
        let icon = null;
        if (uploadProgress?.message === "Creating document index...") {
            icon = <img src="https://services.google.com/fh/files/misc/applet-upload.png" alt="Uploading files icon" className="h-80 w-80 rounded-lg object-cover" />;
        } else if (uploadProgress?.message === "Generating embeddings...") {
            icon = <img src="https://services.google.com/fh/files/misc/applet-creating-embeddings_2.png" alt="Creating embeddings icon" className="h-240 w-240 rounded-lg object-cover" />;
        } else if (uploadProgress?.message === "Generating suggestions...") {
            icon = <img src="https://services.google.com/fh/files/misc/applet-suggestions_2.png" alt="Generating suggestions icon" className="h-240 w-240 rounded-lg object-cover" />;
        } else if (uploadProgress?.message === "All set!") {
            icon = <img src="https://services.google.com/fh/files/misc/applet-completion_2.png" alt="Completion icon" className="h-240 w-240 rounded-lg object-cover" />;
        }

        return (
            <main className="h-screen bg-gem-onyx text-gem-offwhite">
                <ProgressBar
                    progress={uploadProgress?.current || 0}
                    total={uploadProgress?.total || 1}
                    message={uploadProgress?.message || "Preparing your chat..."}
                    fileName={uploadProgress?.fileName}
                    icon={icon}
                />
            </main>
        );
    }

    if (status === AppStatus.Error) {
        return (
            <main className="flex flex-col items-center justify-center h-screen bg-red-900/20 text-red-300 px-4 text-center">
                <h1 className="text-3xl font-bold mb-4">Application Error</h1>
                <p className="max-w-md mb-4">{error}</p>
                <button onClick={clearError} className="px-4 py-2 rounded-md bg-gem-mist hover:bg-gem-mist/70 transition-colors">
                    Try Again
                </button>
            </main>
        );
    }

    return <main>{renderMain()}</main>;
};

export default App;
