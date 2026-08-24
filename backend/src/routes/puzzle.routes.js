import express from "express";
import { verifyUser, requireVerified } from "../middleware/auth.middleware.js";
import { getPuzzleForUser } from "../controllers/puzzle.controller.js";

const router = express.Router();

router.get("/", verifyUser, requireVerified, getPuzzleForUser);

export default router;
