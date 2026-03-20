declare module "xlsx" {
  type Row = Record<string, unknown>;
  export const utils: {
    sheet_to_json: <T = Row>(sheet: WorkSheet, opts?: object) => T[];
    book_new: () => WorkBook;
    book_append_sheet: (wb: WorkBook, ws: WorkSheet, name: string) => void;
    aoa_to_sheet: (data: unknown[][]) => WorkSheet;
    json_to_sheet: (data: object[]) => WorkSheet;
  };
  export function read(
    data: ArrayBuffer | string,
    opts?: { type?: string },
  ): WorkBook;
  export function writeFile(wb: WorkBook, filename: string): void;
  export interface WorkBook {
    SheetNames: string[];
    Sheets: Record<string, WorkSheet>;
  }
  export interface WorkSheet {
    [key: string]: CellObject | string | number | undefined;
    "!ref"?: string;
  }
  export interface CellObject {
    v?: string | number | boolean;
    t?: string;
    w?: string;
  }
}
