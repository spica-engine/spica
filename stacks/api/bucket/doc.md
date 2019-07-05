# Spica

## Getting Started with Spica
 ### Installing
 ### Setting Up the Environment
## Passport
 ### Identities

 #### What are Identities?
 Identities are the main entities of your Spica. They are basically profiles with custom properties and basic login informations. You can attach Policies (see below) and restrict their access to the Spica.
 
 #### Define Identity Properties
 Here in Spica, Identities are dynamic and changeable domains. 
 
 By default, an Identity object has these properties:
 
 - Identifier: A unique, string type property which is used for logging in.
 - Password: User defined password for authentication.
 - First and Last Name
 - Email

 **But that's not all!**

 You can go the Settings page of Passport and add custom properties to your Identities. 

 Click the `+` icon on Settings page. This will add a string type new property. You can customize the property by changing the `Title`, `Description` and even the `Type` of the property. 
 
 >Note: For more informations about types, go to section: *Bucket Field Types*
 
 #### List Identities 
 You can find the list of your Identities by clicking on the **Identities** from side menu or by going to the `/passport/identity` url. If you've just initialize the Spica, the list would be empty (or with a default `spica` identity depending on your setup configurations.).
 
 Here, you can edit (`pen` button), create (`plus` button) and delete (`trash` button) your Identities.
 
 #### Create an Identity
 To create a new Identity, click on the `+` button on Identities list page or go to `/passport/identity/add` url.
 
 By filling the form on the page, you can create a new Identity. After the creation, you can access the Policies of the Identity. (See below)
 
 ### Policies
 #### What are Policies?
 Policies are basically a set of rules which can be attached to your Identities to capsulate their behaviour. 
 
 Policies made from `Statements`, the primitive rules.
 
 First, let's check out the BucketFullAccess policy:
 
```json
{
	"$schema": "http://spica.internal/passport/policy",
	"_id": "BucketFullAccess",
	"name": "Bucket Full Access",
	"description": "Full access to bucket service.",
	"statement": [
		{
			"effect": "allow",
			"action": "bucket:*",
			"resource": "bucket/*",
			"service": "bucket"
		},
		{
			"effect": "allow",
			"action": "bucket:data:*",
			"resource": "bucket:data/*",
			"service": "bucket:data"
		}
	]
}
```
 
#### Managing Policies
 
#### Creating Custom Policies
 So, you want more control over your Identities? Well... you can. You can create your own Custom Policy by clicking on the `+` button on Policies page to create from scratch or clone a Policy and start to work where it left off by clicking the `copy` button on Policies page next to each policies.
 
 Here you can enter your Policy's `Name` and `Description`.
 
 #### Understanding Statements
 
 Statements are simple rules which allows/denies *actions* such as `bucket:show`, `passport:identity:index` etc.
 
 
 There are a few types of actions:
 
- `*:index`: Listing entries
- `*:show`: Getting single entry
- `*:update`: Updating or creating one entry
- `*:delete`: Deleting entry or entries