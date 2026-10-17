import { Router } from "express";
import {
  index,
  createForm,
  create,
  show,
  transition,
  editForm,
  edit,
  confirmRemove,
  remove,
  addWork,
  removeWork,
  addPart,
  removePart,
  saveDiagnostics,
  saveEstimate,
  approveEstimate,
  rejectEstimate,
  createInvoice,
  addPayment,
  saveWarranty,
  addComment,
  addAttachment,
} from "../controllers/requests.js";

const router = Router();
router.get("/", index);
router.get("/new", createForm);
router.post("/", create);
router.get("/:id", show);
router.post("/:id/transition", transition);
router.get("/:id/edit", editForm);
router.post("/:id/edit", edit);
router.get("/:id/delete", confirmRemove);
router.post("/:id/delete", remove);
router.post("/:id/works", addWork);
router.post("/:id/works/:lineId/delete", removeWork);
router.post("/:id/parts", addPart);
router.post("/:id/parts/:lineId/delete", removePart);
router.post("/:id/diagnostics", saveDiagnostics);
router.post("/:id/estimate", saveEstimate);
router.post("/:id/estimate/approve", approveEstimate);
router.post("/:id/estimate/reject", rejectEstimate);
router.post("/:id/invoice", createInvoice);
router.post("/:id/payments", addPayment);
router.post("/:id/warranty", saveWarranty);
router.post("/:id/comments", addComment);
router.post("/:id/attachments", addAttachment);

export default router;
