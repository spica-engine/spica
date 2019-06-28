import { DocCollection, Processor } from 'dgeni';
import * as path from 'path';

export class ControllerProcessor implements Processor {
  httpMethods = ['Delete', 'Get', 'Post', 'Patch'];
  name = 'controller';

  $process(docs: DocCollection) {
    return docs.map(doc => {
      if (doc.docType == 'class') {
        const controller = doc.decorators!.find((d: any) => d.name == 'Controller');
        if (controller) {
          doc.docType == 'controller';
          doc.path = controller.arguments![0];
          doc.members = doc.members
          .filter((member: any) => member.docType == 'member')
          .map((member: any) => {
            member.decorators = member.decorators || [];
            const methodDecorator = member.decorators!.find((d: any) => this.httpMethods.indexOf(d.name) > -1);
            if ( methodDecorator ) {
              member.docType = 'route';
              member.path = path.join(doc.path, methodDecorator.arguments[0] || '');
            }
          });

        }
      }

      return doc;
    });
  }


}