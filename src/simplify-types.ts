import { unindent } from "./utils/unindent";
import { compileTypes } from "./compile-types";
import { logger } from "./utils/logger";

export function simplifyTypes(config: { sourceFiles: string[], keepPromises?: boolean, typeMask?: string, beautify?: boolean }) {
  return compileTypes({
    include: config.sourceFiles,
    typeMask: config.typeMask,
    beautify: config.beautify,
    sourceCode({ files: sourceFiles }) {
      const code = [];

      if (config.keepPromises) {
        code.push(`
          type SimplifyDeep<T> = T extends (...args: infer A) => infer R
          ? (...args: SimplifyDeep<A>) => SimplifyDeep<R>
          : T extends Promise<infer X>
          ? Promise<SimplifyDeep<X>>
          : T extends object
          ? T extends infer O
          ? { [K in keyof O]: SimplifyDeep<O[K]> }
          : never
          : T;
        `);
      } else {
        code.push(`
          type SimplifyDeep<T> = T extends (...args: infer A) => infer R
          ? (...args: SimplifyDeep<A>) => SimplifyDeep<R>
          : T extends object
          ? T extends infer O
            ? { [K in keyof O]: SimplifyDeep<O[K]> }
            : never
          : T;
        `);
      }

      for (let i = 0; i < sourceFiles.length; i++) {
        const sourceFile = sourceFiles[i];
        const sourceTypes = sourceFile.getTypeAliases().filter((t: any) => t.isExported());

        logger.info(`Source file exports ${sourceTypes.length} types: ${sourceTypes.map((t: any) => t.getName()).join(", ")}`);

        code.push(unindent(`
            import * as SOURCES${i} from './${config.sourceFiles[i]}';

            ${sourceTypes
            .map((type: any) => {
              const name = type.getName();
              return unindent(`
                  export type ${name} = SimplifyDeep<SOURCES${i}.${name}>;
                `);
            })
            .join("")}
          `));
      }

      return code.join("\n");
    },
    outputOptions: {
      header: unindent(`
        /* Types generated from '${config.sourceFiles.join(' | ')}' */
      `),
      generateUniqueSymbols: true,
    },
  });
}
