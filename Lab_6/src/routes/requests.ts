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
import { requireRole, ROLES } from "../lib/auth.js";

// Матриця дозволів (Lab 4):
//   МЕНЕДЖЕР+ — створення/редагування/видалення заявок, оцінки, рахунки, оплати, гарантії
//   МАЙСТЕР+  — статус, роботи/запчастини в заявці, діагностика, коментарі, файли
const router = Router();
router.get("/", index);
router.get("/new", requireRole(ROLES.MANAGER), createForm);
router.post("/", requireRole(ROLES.MANAGER), create);
router.get("/:id", show);
router.post("/:id/transition", requireRole(ROLES.TECH), transition);
router.get("/:id/edit", requireRole(ROLES.MANAGER), editForm);
router.post("/:id/edit", requireRole(ROLES.MANAGER), edit);
router.get("/:id/delete", requireRole(ROLES.MANAGER), confirmRemove);
router.post("/:id/delete", requireRole(ROLES.MANAGER), remove);
router.post("/:id/works", requireRole(ROLES.TECH), addWork);
router.post("/:id/works/:lineId/delete", requireRole(ROLES.TECH), removeWork);
router.post("/:id/parts", requireRole(ROLES.TECH), addPart);
router.post("/:id/parts/:lineId/delete", requireRole(ROLES.TECH), removePart);
router.post("/:id/diagnostics", requireRole(ROLES.TECH), saveDiagnostics);
router.post("/:id/estimate", requireRole(ROLES.MANAGER), saveEstimate);
router.post("/:id/estimate/approve", requireRole(ROLES.MANAGER), approveEstimate);
router.post("/:id/estimate/reject", requireRole(ROLES.MANAGER), rejectEstimate);
router.post("/:id/invoice", requireRole(ROLES.MANAGER), createInvoice);
router.post("/:id/payments", requireRole(ROLES.MANAGER), addPayment);
router.post("/:id/warranty", requireRole(ROLES.MANAGER), saveWarranty);
router.post("/:id/comments", requireRole(ROLES.TECH), addComment);
router.post("/:id/attachments", requireRole(ROLES.TECH), addAttachment);

export default router;
