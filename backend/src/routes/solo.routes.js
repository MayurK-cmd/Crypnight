import express from "express";
import { verifyUser, requireVerified } from "../middleware/auth.middleware.js";
import { validate, schemas } from "../middleware/validate.js";
import {
  startSoloSession,
  submitSoloMove,
  submitSoloAttempt,
  failSoloSession,
  endSoloSessionHandler,
} from "../controllers/solo.controller.js";

const router = express.Router();

// PHASE 1 §3 + §6 — apply Joi validation and requireVerified on every solo route
router.post(
  "/start",
  verifyUser,
  requireVerified,
  validate(schemas.soloStartSchema),
  startSoloSession
);
router.post(
  "/move",
  verifyUser,
  requireVerified,
  validate(schemas.soloMoveSchema),
  submitSoloMove
);
router.post(
  "/submit",
  verifyUser,
  requireVerified,
  validate(schemas.soloSubmitSchema),
  submitSoloAttempt
);
router.post(
  "/fail",
  verifyUser,
  requireVerified,
  validate(schemas.soloFailSchema),
  failSoloSession
);
// PHASE 5 — explicit session-end endpoint. Used by tests + cron path.
// Frontend uses auto-end only; this is for explicit lifecycle control.
router.post(
  "/end",
  verifyUser,
  requireVerified,
  validate(schemas.soloEndSchema),
  endSoloSessionHandler
);

export default router;
