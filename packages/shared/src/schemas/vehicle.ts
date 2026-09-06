import { z } from "zod";
import { VEHICLE_COLORS, VEHICLE_MAKES, VEHICLE_STATUSES } from "../types.js";

const currentYear = new Date().getFullYear();

const baseVehicleFields = {
  plate: z.string().min(1),
  make: z.enum(VEHICLE_MAKES),
  model: z.string().min(1),
  year: z
    .number()
    .int()
    .min(1900, "year >= 1900")
    .max(currentYear + 1, `year <= ${currentYear + 1}`),
  color: z.enum(VEHICLE_COLORS),
  status: z.enum(VEHICLE_STATUSES),
  mileage: z.number().int().nonnegative(),
  purchasedAt: z.coerce.date(),
  ownerId: z.uuid().nullable().optional(),
};

export const createVehicleSchema = z.object(baseVehicleFields);
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
// 同 employee.ts：表單用 input 型別（z.coerce.date() 的 input 為 unknown）。
export type CreateVehicleFormInput = z.input<typeof createVehicleSchema>;

export const updateVehicleSchema = z
  .object({
    plate: z.string().min(1).optional(),
    make: z.enum(VEHICLE_MAKES).optional(),
    model: z.string().min(1).optional(),
    year: z
      .number()
      .int()
      .min(1900)
      .max(currentYear + 1)
      .optional(),
    color: z.enum(VEHICLE_COLORS).optional(),
    status: z.enum(VEHICLE_STATUSES).optional(),
    mileage: z.number().int().nonnegative().optional(),
    purchasedAt: z.coerce.date().optional(),
    ownerId: z.uuid().nullable().optional(),
  })
  .strict();

export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
