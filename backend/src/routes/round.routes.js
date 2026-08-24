import express from "express";
import { verifyUser, requireVerified } from "../middleware/auth.middleware.js";
import { validate, schemas } from "../middleware/validate.js";
import {
  startRoundSession,
  completePuzzleInRound,
  getRoundSummary,
} from "../controllers/round.controller.js";

const router = express.Router();

router.post("/start", verifyUser, requireVerified, startRoundSession);
router.post(
  "/puzzle-complete",
  verifyUser,
  requireVerified,
  validate(schemas.roundCompleteSchema),
  completePuzzleInRound
);
router.get("/summary/:round_session_id", verifyUser, requireVerified, getRoundSummary);

export default router;
