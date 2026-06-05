/**
 * 统一的 SVG 图标库（dataURL 形式，可传入颜色）。
 * 与 Web 端 TDesign Icon 风格保持一致：stroke 描边、24x24 viewBox、
 * 线宽 2、圆角端点，整体观感与 lucide / TDesign 类似。
 *
 * 用法：
 *   <Image src={iconAdd('#475569')} className="icon-svg" />
 */

/** 把 SVG 字符串转成可用于 <Image src> 的 dataURL */
function svgUrl(body: string, color: string, size = 24): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
  // utf8 编码方式在微信小程序基础库 ≥ 2.18 支持，也兼容 H5。
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const P = {
  add: '<path d="M12 5v14M5 12h14"/>',
  list:
    '<line x1="3" y1="6" x2="21" y2="6"/>' +
    '<line x1="3" y1="12" x2="21" y2="12"/>' +
    '<line x1="3" y1="18" x2="21" y2="18"/>',
  logout:
    '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>' +
    '<polyline points="16 17 21 12 16 7"/>' +
    '<line x1="21" y1="12" x2="9" y2="12"/>',
  qrcode:
    '<rect x="3" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="14" y="3" width="7" height="7" rx="1"/>' +
    '<rect x="3" y="14" width="7" height="7" rx="1"/>' +
    '<line x1="14" y1="14" x2="14" y2="17"/>' +
    '<line x1="14" y1="20" x2="14" y2="21"/>' +
    '<line x1="17" y1="14" x2="17" y2="14"/>' +
    '<line x1="17" y1="17" x2="17" y2="21"/>' +
    '<line x1="20" y1="14" x2="21" y2="14"/>' +
    '<line x1="20" y1="17" x2="21" y2="17"/>' +
    '<line x1="20" y1="20" x2="21" y2="20"/>',
  scan:
    '<path d="M3 7V5a2 2 0 0 1 2-2h2"/>' +
    '<path d="M17 3h2a2 2 0 0 1 2 2v2"/>' +
    '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/>' +
    '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/>' +
    '<line x1="7" y1="12" x2="17" y2="12"/>',
  upload:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
    '<polyline points="17 8 12 3 7 8"/>' +
    '<line x1="12" y1="3" x2="12" y2="15"/>',
  folder:
    '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
  copy:
    '<rect x="9" y="9" width="13" height="13" rx="2"/>' +
    '<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  link:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>' +
    '<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  arrowRight: '<polyline points="9 18 15 12 9 6"/>',
  imagePlus:
    '<path d="M19 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"/>' +
    '<circle cx="9" cy="11" r="2"/>' +
    '<polyline points="21 15 16 10 5 21"/>' +
    '<line x1="19" y1="3" x2="19" y2="9"/>' +
    '<line x1="22" y1="6" x2="16" y2="6"/>',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>' +
    '<polyline points="7 10 12 15 17 10"/>' +
    '<line x1="12" y1="15" x2="12" y2="3"/>',
  user:
    '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
    '<circle cx="12" cy="7" r="4"/>',
  trash:
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>' +
    '<line x1="10" y1="11" x2="10" y2="17"/>' +
    '<line x1="14" y1="11" x2="14" y2="17"/>',
};

// 默认色（接近 TDesign text-2 / slate-600）
const DEFAULT_COLOR = '#475569';

export const iconAdd = (c: string = DEFAULT_COLOR) => svgUrl(P.add, c);
export const iconList = (c: string = DEFAULT_COLOR) => svgUrl(P.list, c);
export const iconLogout = (c: string = DEFAULT_COLOR) => svgUrl(P.logout, c);
export const iconQrcode = (c: string = DEFAULT_COLOR) => svgUrl(P.qrcode, c);
export const iconScan = (c: string = DEFAULT_COLOR) => svgUrl(P.scan, c);
export const iconUpload = (c: string = DEFAULT_COLOR) => svgUrl(P.upload, c);
export const iconFolder = (c: string = DEFAULT_COLOR) => svgUrl(P.folder, c);
export const iconCopy = (c: string = DEFAULT_COLOR) => svgUrl(P.copy, c);
export const iconLink = (c: string = DEFAULT_COLOR) => svgUrl(P.link, c);
export const iconArrowRight = (c: string = '#cbd5e1') => svgUrl(P.arrowRight, c);
export const iconImagePlus = (c: string = DEFAULT_COLOR) => svgUrl(P.imagePlus, c);
export const iconDownload = (c: string = DEFAULT_COLOR) => svgUrl(P.download, c);
export const iconUser = (c: string = DEFAULT_COLOR) => svgUrl(P.user, c);
export const iconTrash = (c: string = DEFAULT_COLOR) => svgUrl(P.trash, c);
