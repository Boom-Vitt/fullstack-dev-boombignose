import { Router } from "express";
import { z } from "zod";

import { prisma } from "./prisma";
import { asyncHandler } from "./asyncHandler";
import { requireAuth } from "./authMiddleware";
import { MessageRole } from "@prisma/client";

const router = Router();

const createChatSchema = z.object({
  manualId: z.string().cuid(),
});

const messageSchema = z.object({
  role: z.nativeEnum(MessageRole),
  content: z.string().min(1),
  grounding: z.any().optional(),
});

router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const chats = await prisma.chatSession.findMany({
      where: { userId: req.user!.id },
      include: {
        manual: {
          select: {
            id: true,
            title: true,
            ragStoreName: true,
            documentName: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json(chats);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = createChatSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
      return;
    }

    const manual = await prisma.manual.findFirst({
      where: { id: parsed.data.manualId, userId: req.user!.id },
    });

    if (!manual) {
      res.status(404).json({ message: "Manual not found" });
      return;
    }

    const chat = await prisma.chatSession.create({
      data: {
        manualId: manual.id,
        userId: req.user!.id,
      },
      include: {
        manual: true,
      },
    });

    res.status(201).json(chat);
  })
);

router.get(
  "/:chatId/messages",
  asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const chat = await prisma.chatSession.findFirst({
      where: { id: chatId, userId: req.user!.id },
    });

    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    const messages = await prisma.message.findMany({
      where: { chatSessionId: chat.id },
      orderBy: { createdAt: "asc" },
    });

    res.json(messages);
  })
);

router.post(
  "/:chatId/messages",
  asyncHandler(async (req, res) => {
    const { chatId } = req.params;
    const payload = messageSchema.safeParse(req.body);
    if (!payload.success) {
      res.status(400).json({ message: "Invalid payload", issues: payload.error.flatten() });
      return;
    }

    const chat = await prisma.chatSession.findFirst({
      where: { id: chatId, userId: req.user!.id },
    });

    if (!chat) {
      res.status(404).json({ message: "Chat not found" });
      return;
    }

    const message = await prisma.message.create({
      data: {
        chatSessionId: chat.id,
        role: payload.data.role,
        content: payload.data.content,
        grounding: payload.data.grounding,
      },
    });

    await prisma.chatSession.update({
      where: { id: chat.id },
      data: { updatedAt: new Date() },
    });

    res.status(201).json(message);
  })
);

export const chatRouter = router;
