// nodemailer não publica tipos próprios e o projeto não instala
// @types/nodemailer. Declaração ambiente mínima (mesmo padrão de
// qrcode-terminal.d.ts) para satisfazer noImplicitAny sem adicionar dependência.
declare module "nodemailer";
