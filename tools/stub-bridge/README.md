# Dynadoc local stub bridge

Dynadoc is open core. This repository holds the client; the middleware bridge
the client talks to is not published. Without a bridge the client installs,
starts, and then fails on its first call, which makes this repository readable
but not runnable.

The stub bridge closes that gap. It answers the same HTTP contract the real
bridge answers, on the channels a document editor genuinely needs, backed by one
directory on your own disk. No account, no cloud, no licence, no sealing.

## Run it

Install once:

```sh
npm install
```

If that fails, it will most likely be `puppeteer`, whose install step
downloads a copy of Chrome. When that download cannot be reached, npm does not
degrade: it rolls the whole install back and removes `node_modules`. Skip the
download and try again:

```sh
PUPPETEER_SKIP_DOWNLOAD=true npm install
```

`npm install --ignore-scripts` also works for the web client, which needs none
of the desktop build's native modules. On npm 11.19 and later it changes
nothing, since install scripts no longer run by default.

Then two commands, in two terminals:

```sh
npm run stub-bridge
```

```sh
npm run dev:web:stub
```

Then open the URL Vite prints (`http://localhost:5173` by default). The first
load compiles a large dependency graph and can take a minute; if Vite says it
re-optimized dependencies and the page errors, reload once.

The stub seeds one document to open: `Welcome.html`, inside `home/`, which the
file explorer shows as `Welcome`. It is not at the top of the drive.

## Where this stands

Being straight about it, since the point of the stub is that you can trust
what it tells you.

What is verified: the app boots against the stub, the shell renders, and the
document pipeline runs end to end against your disk. Creating a document
writes `index.html`, `index.info.json` and `index.config.json` under the stub
root, and reads come back through the stub. Every filesystem channel, the
refusals, the path-escape guard and the asset stream were exercised directly
over HTTP.

The editor opens. `Welcome.html` loads from disk through the stub into a
document tab with the full ribbon, and the content is there. It opens in the
source view, with HTML, MD and JSON tabs, rather than in rich rendering.

What has not been shown end to end is the round trip of editing in the editor
and saving back to disk from the interface. Writes themselves work: creating a
document writes its files, and the save channels were exercised directly. If
you do that round trip, or if you hit a wall, say so in an issue.

Two notes on measuring this yourself. A headless browser can run the whole
flow, but it has a hard time seeing the editor once it is up, so do not read
an empty DOM probe as a broken editor. And the onboarding tour is modal: it
sits over the `New Document` button and swallows the click, so dismiss it
before deciding anything is wrong.

## Why the dev script sets the variable inline

`dev:web:stub` is `dev:web` with `VITE_API_URL` pointed at the stub, set on
the command line rather than in a file, and that is not a style choice.

The web build sets `root: './src/renderer'`, and Vite looks for `.env` files
in `envDir`, which defaults to `root`. The `.env` files at the top of this
repository are therefore never read by the web target. Putting `VITE_API_URL`
in one of them does nothing, which is a slow way to discover that plain
`npm run dev:web` has no API base configured at all.

And with none configured, the client does not stop. It falls through five
steps, the last of which is the production API, hardcoded. There is no "no
backend" state: anything unconfigured is production.

One consequence worth knowing because it survives a reload. If the client ever
reaches a real backend, it stores that address under `ddoc.api_url` in local
storage, and from then on that address wins over `VITE_API_URL`. Pointing the
app back at the stub does not clear it, so every call keeps going to the
address that was stored. If the stub's terminal stays silent while the app is
clearly busy, clear that key from local storage and reload.

The stub prints its drive root when it starts. By default that is
`~/.dynadoc-stub`, holding `home/`, `tmp/`, `cache/` and `public-temp/`, which
are the four roots the client asks for. Everything the editor writes lands
there as an ordinary file you can open with anything else.

| Variable            | Default           | Meaning                             |
| ------------------- | ----------------- | ----------------------------------- |
| `DYNADOC_STUB_ROOT` | `~/.dynadoc-stub` | directory backing the virtual drive |
| `DYNADOC_STUB_PORT` | `7070`            | port to listen on                   |

The port is not as free as it looks. The client ships a Content Security
Policy in `src/renderer/index.html` whose `connect-src` allowlists
`http://localhost:7070` and nothing else on the loopback interface. Move the
stub to another port and the browser refuses every call before it leaves the
page, with no request reaching the stub to explain why. Changing the port
means adding the new origin to that policy. The same goes for the host:
`127.0.0.1` is a different origin to CSP, and it is not on the list, which is
why `dev:web:stub` says `localhost`.

UI preferences are kept in `<stub root>.settings.json`, deliberately beside
the drive rather than inside it, so a file belonging to the stub never shows
up as one of your documents.

It needs nothing but Node. No dependencies, no build step, no Go toolchain.

## It never pretends

This is the rule the stub is built around, and the reason to trust what you see
in it.

Every channel the stub does not implement returns a named refusal: HTTP 400 and
the same `{ "error": ... }` shape the real bridge uses for an unsupported
channel, so the client's existing error path handles it unchanged. The channel
name is also logged to the stub's terminal, so you can watch what the client is
asking for.

What the stub will never do is answer an empty list, a `false`, or a cheerful
`true` in place of a feature it does not have. A stub that silently pretended to
seal a document, or quietly returned nothing where the real bridge returns data,
would be worse than no stub at all: it would teach you a behaviour the product
does not have, and hide real bugs behind it.

For the same reason, where the stub mirrors a quirk of the real bridge it does
so on purpose, and the code says where. Those places are the contract, not an
oversight to tidy up.

## What it implements

All fourteen filesystem channels, against real files:

| Channel                        | Behaviour                                                         |
| ------------------------------ | ----------------------------------------------------------------- |
| `fs:readFile`                  | reads the file and returns it as a string                          |
| `fs:writeFile`, `writeFileSync`| writes, creating parent directories                                |
| `fs:existsSync`                | `true` or `false`                                                  |
| `fs:statSync`, `fs:lstatSync`  | one drive entry                                                    |
| `fs:readdir`, `fs:readdirSync` | a list of drive entries                                            |
| `fs:mkdirSync`                 | creates the directory and its parents                              |
| `fs:open`                      | echoes the path back, which is all the bridge does over HTTP       |
| `fs:unlinkSync`                | deletes                                                            |
| `fs:move`                      | renames, and answers with `from` and `to` at the top level         |
| `fs:copy`                      | copies, directories included                                       |
| `fs:serveAsset`                | streams the file with a content type, for the asset loader         |

Plus the constants the client asks for at boot, which are paths and nothing
else: `os:homedir`, `os:tmpdir`, `get-storage-dir`, `get-temp-dir`,
`get-cache-dir`, `get-fonts`.

Plus three more that are local despite their names:

- `settings:get` and `settings:set`, a key to JSON value store kept in one
  file. The bridge keeps the same store in its database, down to a key never
  set reading back as `null` rather than as an error. Without it the editor
  still works but forgets every piece of UI state between reloads, including
  having seen the welcome tour.
- `drive:list` and `drive:get-root`. In the bridge, `drive:list` calls the
  same listing function as `fs:readdir` and returns the same entries, and
  `drive:get-root` is the constant `"/"`. Only the argument shape differs: a
  `{ path }` map instead of a bare string. Answering `fs:readdir` while
  refusing its twin would have been the arbitrary choice.

Two quirks worth knowing before you write code against the filesystem channels,
both mirrored from the real bridge:

- `fs:readFile` ignores its encoding argument and returns a string, so binary
  content comes back through a lossy UTF-8 decode. Read binary through
  `fs:serveAsset` or `POST /api/ipc/invoke-binary`.
- a drive entry uses `path`, `name`, `size`, `mod_time` and `is_dir`. The
  snake_case is the contract. The stub adds no friendlier aliases, because code
  relying on them would break against the real bridge.

Routes: `POST /api/ipc/invoke`, `POST /api/ipc/invoke-binary`, and
`POST /api/ipc/send`, which accepts any channel and does nothing with it,
exactly as the bridge does. Any other route refuses by name.

## What it refuses

Everything else, including sharing, collaboration, sealed `.sddoc` documents,
document conversion, uploads, file watching, AI, grammar, translation,
meetings and forms. Those need the full Dynadoc bridge.

The drive channels other than the two listed above refuse as well.
`drive:resolve-path` is the one to know about: it answers with a reference
into a remote store, and there is no remote here to point at. The client
already catches its failure and falls back to the local path, so you will see
the refusal in the stub's log and nothing break.

There is one session call, and it is a decision rather than an omission.
`auth:get-session` returns a single local user, named as the local stub. It has
to: with no access token the client switches itself into guest mode, answers
every filesystem call locally without sending it, and the stub is never reached
at all. So the stub says who is using it. It is not a pretend cloud account.
There is one user, the person at the keyboard, and the session carries no
subscription, no plan and no entitlement, because there is no licence here.
Anything gated behind one behaves exactly as it does for a user without one.
Every other `auth:` channel refuses.

## Failure injection

A bridge that works is the easy case. The failures that have actually cost
documents are a bridge that refuses a call, and a bridge that answers a wrong
negative, and neither is reachable by running the stub normally. The stub can
produce both, by rule, so that a change can be *shown* to survive them.

```sh
# the bridge refuses one read, the way it did in production
echo 'fs:readFile index.html refuse' > ~/.dynadoc-stub.failures

# the bridge says a file that is there is not there
echo 'fs:existsSync index.config.json deny' > ~/.dynadoc-stub.failures

# delete the file to stop
rm ~/.dynadoc-stub.failures
```

One rule per line, `<channel> <path-suffix> [refuse|deny] [message]`, and `*`
as the suffix matches every path on that channel. `DYNADOC_STUB_FAIL` takes the
same rules separated by `;`, for a run that is meant to fail from the start.
The rule file is read on **every** call, so rules can be turned on and off
while the stub runs and while a page stays open — which is what it takes to
reproduce a failure that is intermittent, and most of these are.

`refuse` answers HTTP 400 and the bridge's bare `{ "error": ... }`, with your
message or, with none, the one production gave:
`open /data/.tmp/ddoc-asset-2968340161.bin: no such file or directory`. The
message is passed through unchanged, with none of the stub's usual prefix: the
point is to reproduce what the bridge said, not to announce the stub.

`deny` is the more interesting one and the more dangerous. It answers the
negative the channel can legitimately return — `false` for `fs:existsSync`,
`''` for a read, `[]` for a listing, `null` for a stat — which are the same
answers the client's own guest-mode and share-cache guards hand back, so they
are shapes it already meets in real life. Nothing in the client can tell a
`deny` from the truth. That is the point: code that writes a default "if the
file is not there" writes it over a file that is, and a rule like the
`fs:existsSync` one above is how you find out whether it still does.

A rule naming a channel that has no negative to answer, or a mode that is
neither word, is reported by name in the log and ignored. A rule that did not
do what it said would be worse than no rule at all.

With no rules, every call takes exactly the path it took before: the stub says
how many are active in its banner, and logs each one it applies.

## A bug you will meet

The client calls `fs:renameSync` and `fs:rmSync`. Nothing implements them:
the production bridge has no handler either, so both fail in production the same
way they fail here. They get their own refusal message saying so, rather than
the generic one, so that nobody reads "needs the full bridge" and goes looking
for a feature that does not exist. Renaming and removing through `fsPromises`
is broken on the web client, and fixing it belongs in the bridge.

## It is a development tool

The stub verifies no token and enforces no permission. It binds to the loopback
interface and refuses any path that escapes its drive root, and that is the
whole of its security. Do not put it on a network, and do not read it as a
description of how the real bridge authenticates.

## Keeping it honest over time

The stub and the real bridge can drift apart, and the stub is the one that
rots, quietly, until a contributor files an issue about behaviour that only
exists here. The guard against that is a contract test: one suite of
`{ channel, args }` cases, run against both, asserting status codes and
response shapes rather than values. It does not exist yet. If you change a
filesystem channel in either place, change it in both and say so in the commit.
