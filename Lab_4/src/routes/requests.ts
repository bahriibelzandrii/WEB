import { Router } from "express";
import {
  index,
  myOrders,
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

// Матриця дозволів (Lab 4, після заміни МЕНЕДЖЕРА на КЛІЄНТА):
//   КЛІЄНТ  — GET /my-orders + картка тільки своїх заявок (скорочена, з фінансами)
//   ВІДВІДУВАЧ — список/картка всіх заявок (read-only)
//   МАЙСТЕР — повна персоналська сила; у списку — лише свої (assignedTo)
//   АДМІН — усе
const router = Router();

// Клієнтська зона (ДО «/» — інакше «/my-orders» сприймалося б як «/:id»).
router.get("/my-orders", requireRole(["CLIENT"]), myOrders);

router.get("/", requireRole(ROLES.VIEW), index);
router.get("/new", requireRole(ROLES.STAFF), createForm);
router.post("/", requireRole(ROLES.STAFF), create);
router.get("/:id", requireRole(["ADMIN", "TECHNICIAN", "VISITOR", "CLIENT"]), show);
router.post("/:id/transition", requireRole(ROLES.STAFF), transition);
router.get("/:id/edit", requireRole(ROLES.STAFF), editForm);
router.post("/:id/edit", requireRole(ROLES.STAFF), edit);
router.get("/:id/delete", requireRole(ROLES.STAFF), confirmRemove);
router.post("/:id/delete", requireRole(ROLES.STAFF), remove);
router.post("/:id/works", requireRole(ROLES.STAFF), addWork);
router.post("/:id/works/:lineId/delete", requireRole(ROLES.STAFF), removeWork);
router.post("/:id/parts", requireRole(ROLES.STAFF), addPart);
router.post("/:id/parts/:lineId/delete", requireRole(ROLES.STAFF), removePart);
router.post("/:id/diagnostics", requireRole(ROLES.STAFF), saveDiagnostics);
router.post("/:id/estimate", requireRole(ROLES.STAFF), saveEstimate);
router.post("/:id/estimate/approve", requireRole(ROLES.STAFF), approveEstimate);
router.post("/:id/estimate/reject", requireRole(ROLES.STAFF), rejectEstimate);
router.post("/:id/invoice", requireRole(ROLES.STAFF), createInvoice);
router.post("/:id/payments", requireRole(ROLES.STAFF), addPayment);
router.post("/:id/warranty", requireRole(ROLES.STAFF), saveWarranty);
router.post("/:id/comments", requireRole(ROLES.STAFF), addComment);
router.post("/:id/attachments", requireRole(ROLES.STAFF), addAttachment);

export default router;
