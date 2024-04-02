import { APIGatewayTokenAuthorizerEvent, Context, Callback, APIGatewayAuthorizerEvent, APIGatewayAuthorizerResult, APIGatewayRequestAuthorizerEvent } from 'aws-lambda';

interface PolicyDocument {
  Version: string;
  Statement: Statement[];
}

interface Statement {
  Action: string;
  Effect: 'Allow' | 'Deny';
  Resource: string;
}

// export const handler = async (event: APIGatewayRequestAuthorizerEvent): Promise<APIGatewayAuthorizerResult> => {
  // Get and decode the token passed in the header into username and password
  // Get permissions of user
  // Create policy document 
  // const policy: PolicyDocument = {
  //   Version: '2012-10-17',
  //   Statement: [{
  //     Action: 'execute-api:Invoke',
  //     Effect: 'Allow',
  //     Resource: [
  //       'arn:aws:execute-api:<region>:<account-id>:<api-id>/<stage>/*/*'
  //     ]
  //   }]
  // };
// };

// Helper function to generate the IAM policy for authorization
// const generatePolicy = (principalId: string, effect: string, resource: string, customPolicy?: PolicyDocument): any => {
//   const authResponse: any = {};
//   authResponse.principalId = principalId;
//   if (effect && resource) {
//     authResponse.policyDocument = {
//       Version: '2012-10-17',
//       Statement: [
//         {
//           Action: 'execute-api:Invoke',
//           Effect: effect,
//           Resource: resource
//         }
//       ]
//     };
//   }

//   // Optional: add custom policy from the authorizer logic
//   if (customPolicy) {
//     authResponse.policyDocument.Statement[0].Resource = customPolicy.Statement[0].Resource;
//   }

//   return authResponse;
// };
