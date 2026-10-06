import type { Enums } from "@/lib/types/database";
import { type RowResult, toNumber, toStringOrNull } from "./spreadsheet-import";

type UnitOfMeasure = Enums<"unit_of_measure">;
const UNITS: UnitOfMeasure[] = ["No.", "Mtr", "Kg", "Set", "Pair", "Lot", "Km"];

export interface BomImportRow {
    finished_item_id: string;
    component_id: string;
    qty_per_unit: number;
    unit: UnitOfMeasure;
    notes: string | null;
}

// itemsByCode maps this org's item_code (uppercased) → item id, so the
// spreadsheet can reference items by their human-readable code instead of
// a UUID. Expected columns: finished_item_code, component_item_code,
// qty_per_unit, unit, notes
export function validateBomRow(
    raw: Record<string, unknown>,
    rowNumber: number,
    itemsByCode: Map<string, string>,
): RowResult<BomImportRow> {
    const errors: string[] = [];

    const finishedCode = String(raw.finished_item_code ?? "").trim()
        .toUpperCase();
    const componentCode = String(raw.component_item_code ?? "").trim()
        .toUpperCase();

    if (!finishedCode) errors.push("finished_item_code is required");
    if (!componentCode) errors.push("component_item_code is required");

    const finished_item_id = itemsByCode.get(finishedCode);
    if (finishedCode && !finished_item_id) {
        errors.push(
            `no item found with code "${finishedCode}" in this organization`,
        );
    }

    const component_id = itemsByCode.get(componentCode);
    if (componentCode && !component_id) {
        errors.push(
            `no item found with code "${componentCode}" in this organization`,
        );
    }

    if (finishedCode && componentCode && finishedCode === componentCode) {
        errors.push(
            "finished_item_code and component_item_code cannot be the same item",
        );
    }

    const qty_per_unit = toNumber(raw.qty_per_unit, 0);
    if (qty_per_unit <= 0) errors.push("qty_per_unit must be greater than 0");

    const unitInput = String(raw.unit ?? "No.").trim();
    const unit = UNITS.find((u) => u.toLowerCase() === unitInput.toLowerCase());
    if (!unit) errors.push(`unit must be one of: ${UNITS.join(", ")}`);

    if (errors.length > 0 || !finished_item_id || !component_id || !unit) {
        return { rowNumber, raw, data: null, errors };
    }

    return {
        rowNumber,
        raw,
        errors: [],
        data: {
            finished_item_id,
            component_id,
            qty_per_unit,
            unit,
            notes: toStringOrNull(raw.notes),
        },
    };
}
