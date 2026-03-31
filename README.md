# TV Time

### _**Third-party fork by [@kris.darkworld.download](https://bsky.app/profile/did:plc:s7cesz7cr6ybltaryy4meb6y).**_

Welcome friends! This is the codebase for TV Time - a fork of the Bluesky Social
app.

We are over 151+ commits ahead of `bluesky-social/social-app:main` on GitHub.
ATProto Based 🤙🤟

Our main repo is on
**[Tangled](https://tangled.sh/did:plc:s7cesz7cr6ybltaryy4meb6y/BlueskyOnCrack)**.

<details>
<summary>**HOW TO INSTALL (iOS ONLY)**</summary>

This app was tested on:

- iPhone 15, iOS 26.4 Developer Beta;
- ~~iPhone 7, iOS 15.8.1~~

Push Notifications and photo saving MAY NOT WORK!!!

1. Download the iOS build from GitHub CI _(latest run -> artifacts -> .ipa)_:

- **iOS App:**
  https://github.com/OCbwoy3-Chan/social-app/actions/workflows/build-ios-unsigned.yaml
- **Expo Dev Build (for development only!!):**
  https://github.com/OCbwoy3-Chan/social-app/actions/workflows/build-ios-dev-client-unsigned.yaml

2. Install and set up Custom DNS:

- https://sideloading.vercel.app/guide
- https://sideloading.vercel.app/tips

3. Install either Esign or Ksign from Khoindvn. If you're on iOS 16+, you may
   need to reboot to install profiles or apps.

4. ???

</details>

Here's a list of crack features, consolidated into each category:

<details>
<summary>Settings</summary>

Tools:

- [x] Verification settings
- [x] Alter Egos

Appearance ([witchsky](https://tangled.org/jollywhoppers.com/witchsky.app)):

- [x] Rename posts to skeets
- [x] Custom themes

Profiles:

- [x] Disable suggested follows
- [x] Unrounded (expanded) metrics
- [x] Always show Germ DM button

Feed:

- [x] Disable composer prompt

Advanced:

- [x] ATProto frickery
- [x] Bypass !hide
- [x] Remove labeler limit
- [x] Disable AppLabelers
- [x] NUXs!
- [x] Feature gate editor

</details>

<details>
<summary>Features</summary>

- [x] Profile pronouns and link support
- [x] iOS support
- [x] Default to our own
      [Castle Town PDS](https://castletown.darkworld.download)

<img width="393" src="assets/images/readme_thing.png"/>

PRs merged in early:

- Soon enough

Works on my iPhone 15, iOS 26.4

What doesn't work:

- Push notifications
- Image saving
- Probably something else aswell.

</details>

Anyway, with my yapping out of the way...

## Development Resources

This is a [React Native](https://reactnative.dev/) application, written in the
TypeScript programming language. It builds on the `atproto` TypeScript packages
(like [`@atproto/api`](https://www.npmjs.com/package/@atproto/api)), which are
also open source, but in
[a different git repository](https://github.com/bluesky-social/atproto).

There is a small amount of Go language source code (in `./bskyweb/`), for a web
service that returns the React Native Web application.

The [Build Instructions](./docs/build.md) are a good place to get started with
the app itself.

The Authenticated Transfer Protocol ("AT Protocol" or "atproto") is a
decentralized social media protocol. You don't _need_ to understand AT Protocol
to work with this application, but it can help. Learn more at:

- [Overview and Guides](https://atproto.com/guides/overview)
- [Protocol Specifications](https://atproto.com/specs/atp)
- [Bluesky's Blogpost on self-authenticating data structures](https://bsky.social/about/blog/3-6-2022-a-self-authenticating-social-protocol)

The app encompasses a set of schemas and APIs built in the overall AT Protocol
framework. The namespace for these "Lexicons" is `app.bsky.*`.

## Contributions

> Bluesky On Crack is a fork of Bluesky.. PRs are welcome!

**Guidelines:**

- Check for existing issues before filing a new one please.
- Stay away from PRs like...
  - Changing "Post" to "Skeet."
  - Refactoring the codebase, e.g., to replace React Query with Redux Toolkit or
    something.

## Forking guidelines

You have our blessing 🪄✨ to fork this application! However, it's very
important to be clear to users when you're giving them a fork.

Please be sure to:

- Change all branding in the repository and UI to clearly differentiate from
  Bluesky or Bluesky On Crack.
- Change any support links (feedback, email, terms of service, etc) to your own
  systems.
- Replace any analytics or error-collection systems with your own so we don't
  get super confused.

## Are you a developer interested in building on atproto?

Bluesky is an open social network built on the AT Protocol, a flexible
technology that will never lock developers out of the ecosystems that they help
build. With atproto, third-party integration can be as seamless as first-party
through custom feeds, federated services, clients, and more.

## License (MIT)

See [./LICENSE](./LICENSE) for the full license.

Bluesky Social PBC has committed to a software patent non-aggression pledge. For
details see
[the original announcement](https://bsky.social/about/blog/10-01-2025-patent-pledge).

## P.S.

We ❤️ you and all of the ways you support us. Thank you for making Bluesky a
great place!
