// Some handy utility functions
import cryptoRandomString from "crypto-random-string";

// Returns a random number between min and max
export const random = (min: number, max: number): number => {
  min = Math.ceil(min);
  max = Math.floor(max) + 1;
  return Math.floor(Math.random() * (max - min) + min);
};

export const randomString = (count: number): string => {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvxyz0123456789";
  return cryptoRandomString({ length: count, characters: characters });
};

export function stackTrace(): string {
  const error = new Error();
  if (!error.stack) {
    return "";
  }

  // Skip first line to ensure the caller line is the first line
  const lines = error.stack.split("\n");
  return lines.slice(2).join("\n");
}

// Returns the distance between 2 points
export const distance = (
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number => {
  return Math.sqrt((x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2));
};

// Returns the sha 256 hash of the string
export async function sha256Hash(text: string): Promise<string> {
  // encode as UTF-8
  const msgBuffer = new TextEncoder().encode(text);

  // hash the message
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);

  // convert ArrayBuffer to Array
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // convert bytes to hex string
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex;
}

export const fetchFiles = (
  paths: string[],
  result: (files: string[]) => void
): void => {
  Promise.all(paths.map((path) => fetch(path)))
    .then((responses) => {
      // Get the file for each response
      return Promise.all(
        responses.map((response) => {
          return response.text();
        })
      );
    })
    .then((files) => {
      result(files);
    })
    .catch((error) => {
      // if there's an error, log it
      result([]);
      console.log(error);
    });
};

export async function fetchFilesAsync(paths: string[]): Promise<string[]> {
  try {
    const responses = await Promise.all(paths.map((path) => fetch(path)));
    const files = await Promise.all(
      responses.map((response) => response.text())
    );
    return files;
  } catch (error) {
    return [];
  }
}

export function arrayToString(array: Uint8Array, charactersSet: string) {
  let text = "";
  for (var i = 0; i < array.length; i++) {
    text += charactersSet.charAt(array[i] % charactersSet.length);
  }
  return text;
}

export const svgToSvgDataUrl = (svg: string): string => {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
};

export function parseNestedSvgPaths(text: string) {
  const regexp = new RegExp('xlink:href="/static/media[^"]*', "g");

  let uniquePaths: string[] = [];

  let match;
  while ((match = regexp.exec(text)) !== null) {
    const ref = `${match[0]}`;
    const path = ref.substring(12);
    if (!uniquePaths.includes(path)) {
      uniquePaths.push(path);
    }
  }
  return uniquePaths;
}

export function replacePathsWithSvgDataUrls(
  svgText: string,
  paths: string[],
  svgImages: string[]
) {
  for (let i = 0; i < paths.length; i++) {
    const path = paths[i];
    const svgImage = svgImages[i];
    const svgDataUrl =
      "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgImage);
    svgText = svgText.replaceAll(
      `xlink:href="${path}"`,
      `xlink:href="${svgDataUrl}"`
    );
  }
  return svgText;
}

export const publishAsDownload = (dataUrl: string, name: string) => {
  var link = document.createElement("a");
  link.download = name;
  link.style.opacity = "0";
  document.body.append(link);
  link.href = dataUrl;
  link.click();
  link.remove();
};

export const imgDataUrlToPngDataUrl = (
  imgDataUrl: string,
  width: number,
  height: number,
  result: (url: string) => void
) => {
  const image = new Image();
  image.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    context?.drawImage(image, 0, 0, canvas.width, canvas.height);

    const pngDataUrl = canvas.toDataURL(); // default png

    result(pngDataUrl);
  };

  image.src = imgDataUrl;
};
