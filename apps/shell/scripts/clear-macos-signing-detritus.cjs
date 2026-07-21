const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

module.exports = async function clearMacosSigningDetritus(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`;

  await execFileAsync("xattr", ["-cr", appPath]);
  await removeAttribute("com.apple.provenance", appPath);
};

async function removeAttribute(attribute, path) {
  try {
    await execFileAsync("xattr", ["-dr", attribute, path]);
  } catch (error) {
    if (!String(error.stderr).includes("No such xattr")) {
      throw error;
    }
  }
}
