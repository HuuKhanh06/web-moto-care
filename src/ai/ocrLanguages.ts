// Khi không đặt `langPath`, tesseract.js (LSTM-only) tự tải từ đúng URL này.
// Luồng chính tải trước cùng URL để báo lỗi mạng sớm và làm nóng HTTP cache cho worker.
export const tesseractLanguageUrl = (code: string) =>
  `https://cdn.jsdelivr.net/npm/@tesseract.js-data/${code}/4.0.0_best_int/${code}.traineddata.gz`;
