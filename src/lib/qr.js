const QRCode = require("qrcode");

// Returns a data:image/png;base64 URI so the widget's popup can just set it
// as an <img src>, with no separate image-hosting endpoint or extra domain
// needed in the manifest's networkAccess allowlist.
async function walletQrDataUrl(address) {
  return QRCode.toDataURL(address, { width: 220, margin: 1 });
}

module.exports = { walletQrDataUrl };
