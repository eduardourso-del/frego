# Optional QR presentment of the Voucher Código

Staff Confirmar of a Voucher stays a typed or looked-up Código. The customer app may also show that same Código as a QR so the till can fill the field; scan does not Confirmar.

We rejected auto-Confirmar on decode (wrong phone and leftover ticket amount cannot be undone from the till), a URL or namespaced second token (the Código is already the bearer), customer-scans-the-till (trust change), QR-only (notebook and maquininha without a camera), and a desktop-web scanner (lid webcam faces the operator). No torch on the viewfinder.

## Considered Options

- Scan-to-Confirmar vs scan-to-fill: fill, then **Usar**
- Payload as HTTPS/deep link vs the Código: the Código
- Staff camera vs customer scanning a till QR: staff scans the customer’s phone
- Scan on desktop web `/counter`: no; PDV and mobile web only, when a camera exists
