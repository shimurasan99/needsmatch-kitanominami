import { FORM_SHEET_ID, FORM_TAB_ID } from "@/lib/admin/form-response";

// Standalone Apps Script: no source cells or sharing settings are changed.
export function googleFormScript(secret: string) {
  return `// 北のみなみ HP連携。Googleシートの値は変更しません。第三者に共有しないでください。
const NM_SHEET_ID = ${JSON.stringify(FORM_SHEET_ID)};
const NM_TAB_ID = ${FORM_TAB_ID};
const NM_ENDPOINT = "https://www.kitanominami.com/api/integrations/google-forms";
const NM_TOKEN = ${JSON.stringify(secret)};

function installNeedsMatchSync() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("NM_NEXT_ROW")) props.setProperty("NM_NEXT_ROW", "2");
  const existing = ScriptApp.getProjectTriggers().map(t => t.getHandlerFunction());
  if (!existing.includes("needsMatchOnSubmit")) ScriptApp.newTrigger("needsMatchOnSubmit").forSpreadsheet(NM_SHEET_ID).onFormSubmit().create();
  if (!existing.includes("syncNeedsMatchResponses")) ScriptApp.newTrigger("syncNeedsMatchResponses").timeBased().everyMinutes(5).create();
  syncNeedsMatchResponses();
}

function needsMatchOnSubmit(e) {
  if (!e || !e.range || e.range.getSheet().getSheetId() !== NM_TAB_ID) return;
  // A malformed historical row must not delay a new form submission.
  const sheet = e.range.getSheet();
  checkNeedsMatchHeaders(sheet);
  const values = sheet.getRange(e.range.getRow(), 1, 1, 25).getDisplayValues()[0];
  sendNeedsMatchRow(e.range.getRow(), values);
  syncNeedsMatchResponses();
}

function sendNeedsMatchRow(row, values) {
  const response = UrlFetchApp.fetch(NM_ENDPOINT, { method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + NM_TOKEN }, payload: JSON.stringify({ spreadsheetId: NM_SHEET_ID, sheetId: NM_TAB_ID, row: row, values: values }), muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) throw new Error("HPへの送信失敗（行" + row + "、HTTP " + response.getResponseCode() + "）。次回同じ行から再送します。");
}

function checkNeedsMatchHeaders(sheet) {
  const headers = sheet.getRange(1, 1, 1, 25).getDisplayValues()[0];
  if (headers[0] !== "タイムスタンプ" || !headers[2].includes("開催日") || headers[10] !== "会社名／屋号" || headers[23] !== "お名前（フルネーム）") throw new Error("回答の列構成が変わりました。HP連携の設定を確認してください。");
}

function syncNeedsMatchResponses() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    const sheet = SpreadsheetApp.openById(NM_SHEET_ID).getSheets().find(s => s.getSheetId() === NM_TAB_ID);
    if (!sheet) throw new Error("申込回答シートが見つかりません。");
    checkNeedsMatchHeaders(sheet);
    const props = PropertiesService.getScriptProperties();
    let row = Number(props.getProperty("NM_NEXT_ROW") || "2");
    const last = Math.min(sheet.getLastRow(), row + 49);
    if (last < row) return;
    const values = sheet.getRange(row, 1, last - row + 1, 25).getDisplayValues();
    for (let i = 0; i < values.length; i++, row++) {
      if (values[i][0]) {
        sendNeedsMatchRow(row, values[i]);
      }
      props.setProperty("NM_NEXT_ROW", String(row + 1));
    }
  } finally { lock.releaseLock(); }
}
`;
}
