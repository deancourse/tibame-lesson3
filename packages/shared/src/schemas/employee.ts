import { z } from "zod";
import { DEPARTMENTS, EMPLOYEE_STATUSES, POSITIONS, ROLES } from "../types.js";

const baseEmployeeFields = {
  employeeNo: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  department: z.enum(DEPARTMENTS),
  position: z.enum(POSITIONS),
  hiredAt: z.coerce.date(),
  phone: z.string().min(1),
};

export const createEmployeeSchema = z.object({
  ...baseEmployeeFields,
  username: z.string().min(1),
  initialPassword: z.string().min(8, "密碼長度需 >= 8"),
  role: z.enum(ROLES).default("USER"),
  status: z.enum(EMPLOYEE_STATUSES).default("ACTIVE"),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
// Zod 4 起 input/output 型別分離（default/coerce 欄位在 input 為 optional/unknown），
// 表單（react-hook-form）以 input 型別宣告欄位、提交後拿到 output 型別。
export type CreateEmployeeFormInput = z.input<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({
    employeeNo: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    email: z.email().optional(),
    department: z.enum(DEPARTMENTS).optional(),
    position: z.enum(POSITIONS).optional(),
    hiredAt: z.coerce.date().optional(),
    phone: z.string().min(1).optional(),
    username: z.string().min(1).optional(),
    role: z.enum(ROLES).optional(),
    status: z.enum(EMPLOYEE_STATUSES).optional(),
  })
  .strict();

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
