# tsl-site

## Administration

Make sure you have an API key. Set the following header on each request you make:
```
{
    "X-Api-Key": "YOUR_API_KEY_HERE" 
}
```

### Add User

Make the following request a POST request to https://api.tslsite.com/user with the following body:
```
{
    "leagues": [
        {
            "decklistUrl": "DECKLIST URL (e.g. https://moxfield.com/decks/*******)",
            "leaguename": "NAME OF THE ACTIVE LEAGUE"
        }
    ],
    "password": "PASSWORD_FOR_NEW_USER",
    "username": "DISPLAY_NAME_FOR_NEW_USER"
}
```

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template
