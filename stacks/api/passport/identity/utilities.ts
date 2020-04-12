export function attachIdentityAcces(request: any) {
  if (
    request.method == "PUT" &&
    request.params.id == request.user._id &&
    !request.user.policies.includes("IdentityFullAccess")
  ) {
    request.user.policies.push("IdentityFullAccess");
  }
  return request;
}
