import path from "path";
import multer from "multer";
import fs from "fs";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

// Strip path separators and "." / ".." segments so req.body values can never
// escape publicFolder via path traversal.
const sanitizePathSegment = (value: unknown): string => {
  if (typeof value !== "string") {
    return "";
  }
  return path.basename(value).replace(/^\.+/, "");
};

export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {

      const typeArch = sanitizePathSegment(req.body.typeArch);
      const fileId = sanitizePathSegment(req.body.fileId);

      let folder;

      if (typeArch && typeArch !== "announcements") {
        folder =  path.resolve(publicFolder , typeArch, fileId ? fileId : "")
      } else if (typeArch && typeArch === "announcements") {
        folder =  path.resolve(publicFolder , typeArch)
      }
      else
      {
        folder =  path.resolve(publicFolder)
      }

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder,  { recursive: true })
        fs.chmodSync(folder, 0o777)
      }
      return cb(null, folder);
    },
    filename(req, file, cb) {
      const typeArch = sanitizePathSegment(req.body.typeArch);

      const safeOriginalName = path.basename(file.originalname).replace(/\//g, '-').replace(/ /g, "_");
      const fileName = typeArch && typeArch !== "announcements" ? safeOriginalName : new Date().getTime() + '_' + safeOriginalName;
      return cb(null, fileName);
    }
  })
};
