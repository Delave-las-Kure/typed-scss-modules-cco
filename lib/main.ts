import { SassError } from "node-sass";
import fs from "fs";
import path from "path";
import glob from "glob";
import chalk from "chalk";

import { Options, fileToClassNames } from "./sass";
import { classNamesToTypeDefinitions } from "./typescript";

const error = (message: string) => console.log(chalk.red(`[ERROR] ${message}`));
const warn = (message: string) => console.log(chalk.yellowBright(`${message}`));
const notice = (message: string) => console.log(chalk.gray(`${message}`));
const success = (message: string) => console.log(chalk.green(message));

export const main = (pattern: string, options: Options): void => {
  // When the provided pattern is a directory construct the proper glob to find
  // all .scss files within that directory. Also, add the directory to the
  // included paths so any imported with a path relative to the root of the
  // project still works as expected without adding many include paths.
  if (fs.lstatSync(pattern).isDirectory()) {
    if (Array.isArray(options.includePaths)) {
      options.includePaths.push(pattern);
    } else {
      options.includePaths = [pattern];
    }

    // When the pattern provide is a directory, assume all .scss files within.
    pattern = path.resolve(pattern, "**/*.scss");
  }

  // Find all the files that match the provied pattern. Always ignore
  // node_modules anywhere in the directory tree.
  const files = glob.sync(pattern, { ignore: "**/node_modules/**" });

  if (!files || !files.length) {
    error("No files found.");
    return;
  }

  // This case still works as expected but it's easy to do on accident so
  // provide a (hopefully) helpful warning.
  if (files.length === 1) {
    warn(
      'Only 1 file found. If using a glob pattern (eg: dir/**/*.scss) make sure to wrap in quotes (eg: "dir/**/*.scss").'
    );
  }

  success(`Found ${files.length} files. Generating type defintions...`);

  for (let index in files) {
    const file = files[index];

    fileToClassNames(file, options)
      .then(classNames => {
        const typeDefinition = classNamesToTypeDefinitions(classNames);
        const path = `${file}.d.ts`;

        if (!typeDefinition) {
          notice(`No types generated for ${file}`);
          return null;
        }

        fs.writeFileSync(path, typeDefinition);
        success(`Generated type defintions: ${path}`);
      })
      .catch(({ message, file, line, column }: SassError) => {
        const location = file ? `(${file}[${line}:${column}])` : "";
        error(`${message} ${location}`);
      });
  }
};