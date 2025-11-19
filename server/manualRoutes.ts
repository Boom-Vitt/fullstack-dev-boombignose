import { Router } from "express";
import { z } from "zod";
import { prisma } from "./prisma";
import { asyncHandler } from "./asyncHandler";
import { requireAuth } from "./authMiddleware";

const manualSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  fileKey: z.string().optional(),
  sourceUrl: z.string().url().optional(),
  mimeType: z.string().optional(),
  documentName: z.string().optional(),
  ragStoreName: z.string().min(1, "RAG store name is required"),
});

const updateSchema = manualSchema.partial();

export const manualRouter = Router();
manualRouter.use(requireAuth);

manualRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;

    const manuals = await prisma.manual.findMany({
      where: {
        userId: req.user!.id,
        ...(search
          ? {
              title: {
                contains: search,
                mode: "insensitive",
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(manuals);
  })
);

manualRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const manual = await prisma.manual.findUnique({ where: { id } });

    if (!manual || manual.userId !== req.user!.id) {
      res.status(404).json({ message: "Manual not found" });
      return;
    }

    res.json(manual);
  })
);

manualRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = manualSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
      return;
    }

    const manual = await prisma.manual.create({
      data: {
        ...parsed.data,
        userId: req.user!.id,
      },
    });
    res.status(201).json(manual);
  })
);

manualRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid payload", issues: parsed.error.flatten() });
      return;
    }

    const manual = await prisma.manual.findUnique({ where: { id } });
    if (!manual || manual.userId !== req.user!.id) {
      return res.status(404).json({ message: "Manual not found" });
    }

    const updated = await prisma.manual.update({
      where: { id },
      data: parsed.data,
    });
    res.json(updated);
  })
);

manualRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const manual = await prisma.manual.findUnique({ where: { id } });
    if (!manual || manual.userId !== req.user!.id) {
      return res.status(404).json({ message: "Manual not found" });
    }
    await prisma.manual.delete({ where: { id } });
    res.status(204).send();
  })
);

