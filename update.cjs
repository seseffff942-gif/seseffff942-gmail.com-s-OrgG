const fs = require('fs');
let content = fs.readFileSync('src/utils.ts', 'utf8');
const oldHtml = `<table style="width: 100%; margin-top: 25px; border-collapse: collapse; page-break-inside: avoid;">
        <tr>
            <td style="width: 48%; text-align: center; vertical-align: middle; padding: 5px;">
                <div style="border: 2px solid #1A4D2E; padding: 12px; border-radius: 12px;">
                    <div style="font-size: 7.5pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; margin-bottom: 4px;">Cuenta BANCO INDUSTRIAL</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000; margin: 2px 0;">035-015252-6</div>
                    <div style="font-size: 7.5pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase;">Agricovet de Guatemala</div>
                    <div style="margin-top: 10px;">
                        <img src="{{biSealUrl}}" alt="SELLO BI" style="width: 130px; height: 130px; object-fit: contain; display: block; margin: 0 auto;" />
                    </div>
                </div>
            </td>
            <td style="width: 4%;">&nbsp;</td>
            <td style="width: 48%; text-align: center; vertical-align: middle; padding: 5px;">
                <div style="border: 2px solid #1A4D2E; padding: 12px; border-radius: 12px;">
                    <div style="font-size: 7.5pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; margin-bottom: 4px;">Cuenta BANRURAL</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000; margin: 2px 0;">3580029532</div>
                    <div style="font-size: 7.5pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase;">Agricovet de Guatemala</div>
                    <div style="margin-top: 10px;">
                        <img src="{{banruralSealUrl}}" alt="SELLO BANRURAL" style="width: 130px; height: 130px; object-fit: contain; display: block; margin: 0 auto;" />
                    </div>
                </div>
            </td>
        </tr>
    </table>`;

const newHtml = `<table style="width: 100%; margin-top: 25px; border-collapse: collapse; page-break-inside: avoid;">
        <tr>
            <td style="width: 48%; text-align: center; vertical-align: middle; padding: 5px;">
                <div style="border: none; padding: 0;">
                    <div style="font-size: 9pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; margin-bottom: 4px;">Depositar a: BANCO INDUSTRIAL</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000; margin: 2px 0;">035-015252-6</div>
                    <div style="margin-top: 10px;">
                        <img src="{{biSealUrl}}" alt="SELLO BI" style="width: 130px; height: 130px; object-fit: contain; display: block; margin: 0 auto;" />
                    </div>
                </div>
            </td>
            <td style="width: 4%;">&nbsp;</td>
            <td style="width: 48%; text-align: center; vertical-align: middle; padding: 5px;">
                <div style="border: none; padding: 0;">
                    <div style="font-size: 9pt; font-weight: 800; color: #1A4D2E; text-transform: uppercase; margin-bottom: 4px;">Depositar a: BANRURAL</div>
                    <div style="font-size: 11pt; font-weight: 900; color: #000; margin: 2px 0;">3580029532</div>
                    <div style="margin-top: 10px;">
                        <img src="{{banruralSealUrl}}" alt="SELLO BANRURAL" style="width: 130px; height: 130px; object-fit: contain; display: block; margin: 0 auto;" />
                    </div>
                </div>
            </td>
        </tr>
    </table>`;

content = content.split(oldHtml).join(newHtml);
fs.writeFileSync('src/utils.ts', content);
