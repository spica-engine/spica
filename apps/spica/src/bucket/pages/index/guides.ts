function guides(rootURL, bucketUrl, firstProp, firstPropValue, secondProp, secondPropValue) {
  let guides = {
    installNPM: {
      title: "Installing Packages",
      description:
        "Before using Bucket library in your client project, you need to install @spica-devkit/bucket module from NPM and import it in your file",
      example: {
        curl: ``,
        js: `//npm install @spica-devkit/bucket

import * as Bucket from '@spica-devkit/bucket'

// If you are sending a request from one of your application users
Bucket.initialize({publicUrl: '${rootURL}', identity: '<YOUR AUTHORIZATION TOKEN>'})

// If you are using machine to machine communication, you can use APIKEY instead of the identity JWT token
Bucket.initialize({publicUrl: '${rootURL}', apikey: '<YOUR APIKEY>'}) `
      }
    },
    getAllWithLimit: {
      title: "Get Data With Limit",
      description:
        "To get all data using limits, simply you can add 'limit' [number] parameter as query params. You can try the live demo below.",
      example: {
        api: `/${bucketUrl}limit=1`,
        curl: `curl --request GET '${rootURL}${bucketUrl}limit=1' \\
--header 'Authorization: <YOUR AUTHORIZATION TOKEN>' \\
--header 'Content-Type: application/json'`,
        js: `import * as Bucket from '@spica-devkit/bucket'

Bucket.initialize({publicUrl: '${rootURL}', identity: '<YOUR AUTHORIZATION TOKEN>'});
const result = await Bucket.data.getAll({ 
    queryParams: { 
        limit: 1 
    } 
});
console.log(result);`
      }
    },
    getAllWithSort: {
      title: "Get Data With Sort & Limit",
      description:
        "To sort your dataset, you can add 'sort' [object] parameter as query params. You can try the live demo below. ",
      example: {
        api: `/${bucketUrl}limit=1&sort={"${firstProp}":1}`,
        curl: `curl --request GET '${rootURL}${bucketUrl}limit=1&sort={"${firstProp}":1}' \\
--header 'Authorization: <YOUR AUTHORIZATION TOKEN>' \\
--header 'Content-Type: application/json'`,
        js: `import * as Bucket from '@spica-devkit/bucket'
                
Bucket.initialize({publicUrl: '${rootURL}', identity: '<YOUR AUTHORIZATION TOKEN>'});
const result = await Bucket.data.getAll({ 
    queryParams: { 
        limit: 1, 
        sort:{ "${firstProp}":1 } 
    } 
});
console.log(result);`
      }
    },
    getWithFilterMongoDb: {
      title: "Get Filtered Data (MongoDB Match Aggregation)",
      description:
        "To filter your data, you can use MongoDB match aggregations in 'filter' [object] query parameter. You can try the live demo below.",
      example: {
        api: `/${bucketUrl}limit=1&filter={"${firstProp}":{"$regex":"${firstPropValue}"}}`,
        curl: `curl --request GET '${rootURL}${bucketUrl}limit=1&filter={"${firstProp}":{"$regex":"${firstPropValue}"}}' \\
--header 'Authorization: <YOUR AUTHORIZATION TOKEN>' \\
--header 'Content-Type: application/json'`,
        js: `import * as Bucket from '@spica-devkit/bucket'

Bucket.initialize({publicUrl: '${rootURL}', identity: '<YOUR AUTHORIZATION TOKEN>'});
const result = await Bucket.data.getAll({ 
    queryParams: { 
        limit: 1, 
        filter: { 
            "${firstProp}":{ "$regex":"${firstPropValue}" } 
        }
    }
});
console.log(result);
`
      }
    },
    getWithFilterRulesEngine: {
      title: "Get Filtered Data (Spica Rules Engine) ",
      description:
        "To filter your data, you can use built-in 'Spica Rules' engine in 'filter' [string] query parameter. You can try the live demo below.",
      example: {
        api: `/${bucketUrl}limit=3&filter=${firstProp}=="${firstPropValue}"`,
        curl: `curl --request GET '${rootURL}${bucketUrl}limit=3&filter=${firstProp}=="${firstPropValue}"' \\
--header 'Authorization: <YOUR AUTHORIZATION TOKEN>' \\
--header 'Content-Type: application/json'`,
        js: `import * as Bucket from '@spica-devkit/bucket'

Bucket.initialize({publicUrl: '${rootURL}', identity: '<YOUR AUTHORIZATION TOKEN>'});
const result = await Bucket.data.getAll({ 
    queryParams: { 
        limit: 1, 
        filter: "${firstProp} == '${firstPropValue}'" 
    } 
});
console.log(result);`
      }
    },
    getWithDoubleFilter: {
      title: "Using Double Filter",
      description:
        "You can apply double filter to your requests as well. You can try the live demo below.",
      example: {
        api: `/${bucketUrl}limit=1&filter={"${firstProp}":{"$regex":"${firstPropValue}"},"${secondProp}":{"$regex":"${secondPropValue}"}}`,
        curl: `curl --request GET '${rootURL}${bucketUrl}limit=1&filter={"${firstProp}":{"$regex":"${firstPropValue}"},"${secondProp}":{"$regex":"${secondPropValue}"}}' \\
--header 'Authorization: <YOUR AUTHORIZATION TOKEN>' \\
--header 'Content-Type: application/json'`,
        js: `import * as Bucket from '@spica-devkit/bucket'

Bucket.initialize({publicUrl: '${rootURL}', identity: '<YOUR AUTHORIZATION TOKEN>'});
const result = await Bucket.data.getAll({ 
    queryParams: { 
        limit: 1, 
        filter: { 
            "${firstProp}":{ "$regex":"${firstPropValue}" },
            "${secondProp}":{ "$regex":"${secondPropValue}" } 
        } 
    } 
});
console.log(result);`
      }
    },
    getDataWithLang: {
      title: "Get Localized Data",
      description:
        "To get localized data, you can use 'Accept-Language' request header. As an example '{Accept-Language: \"en-EN\"}'",
      example: {
        curl: `curl --request GET '${rootURL}${bucketUrl}limit=1' \\
--header 'Authorization: <YOUR AUTHORIZATION TOKEN>' \\
--header 'Content-Type: application/json' \\
--header 'Accept-Language: en-EN'`,

        js: `import * as Bucket from '@spica-devkit/bucket'

Bucket.initialize({publicUrl: '${rootURL}', identity: '<YOUR AUTHORIZATION TOKEN>'});
const result = await Bucket.data.getAll({ 
        headers: { 
            Accept-Language: \"en-EN\" 
        } 
});
console.log(result);`
      }
    },
    getLimitedRealtime: {
      title: "Get Realtime Data",
      description: `To get realtime data using limits, simply you can add 'limit' [number] parameter as query params. Every realtime query will return an Observable. 
                With subscribing to realtime sdk, you can watch every change in your data. Test the realtime connection in your client project please.`,
      example: {
        js: `import * as Bucket from '@spica-devkit/bucket'
                
Bucket.initialize({publicUrl: '${rootURL}', identity: '<YOUR AUTHORIZATION TOKEN>'});
Bucket.data.realtime.getAll({ limit: 1 })
.subscribe(result => console.log(result))`
      }
    }
  };

  let guideArray = [];
  for (let [key, value] of Object.entries(guides)) {
    guideArray.push({key, value});
  }

  return guideArray;
}

export {guides};
