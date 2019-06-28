import { DocCollection, Document, Processor } from 'dgeni';
import * as path from 'path';

export class ModuleProcessor implements Processor {
    name = 'module-processor';
    $runBefore = ['docs-processed'];

    $process(docs: DocCollection) {

        return docs.map(doc => {

            if (doc.docType == 'module') {
                const moduleInfo = getModulePackageInfo(doc);

                const packageName = moduleInfo.packageName;

                const moduleImportPath = `@${packageName == 'api' ? 'spica-server' : 'spica-client'}/$${moduleInfo.name}`;

                doc.importSpecifier = moduleImportPath;
                doc.moduleName = packageName;
                doc.stack = moduleInfo.packageName == 'api' ? 'API' : 'SPICA';
            }
            return doc;
        });
    }
}

/** Resolves module package information of the given Dgeni document. */
function getModulePackageInfo(doc: Document) {
    // Full path to the file for this doc.
    const basePath = doc.fileInfo.basePath;
    const filePath = doc.fileInfo.filePath;

    // All of the component documentation is under either `src/material` or `src/cdk`.
    // We group the docs up by the directory immediately under that root.
    const pathSegments = path.relative(basePath, filePath).split(path.sep);

    return {
        name: pathSegments[1],
        packageName: pathSegments[0]
    };
}