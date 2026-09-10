# Polar regtest network

Polar network **Bolt Bounty** (id 2 on this machine, data under `~/.polar/networks/2`).
Bitcoin Core `backend1` v30 and three LND 0.20 nodes.

## Nodes

| Node     | REST                     | gRPC  | Docker container   |
|----------|--------------------------|-------|--------------------|
| poster   | https://127.0.0.1:8081   | 10001 | polar-n2-poster    |
| platform | https://127.0.0.1:8082   | 10002 | polar-n2-platform  |
| worker   | https://127.0.0.1:8083   | 10003 | polar-n2-worker    |

The API talks only to the platform node. The poster and worker nodes are
driven from the Polar UI during the demo, and from their own REST APIs in the
Phase 3 integration tests.

## Credentials

Each node's files live under `~/.polar/networks/2/volumes/lnd/<node>/`:

- TLS cert: `tls.cert`
- Admin macaroon: `data/chain/bitcoin/regtest/admin.macaroon`

The API takes the macaroon as hex. Produce it with:

```
xxd -p -c 1000 ~/.polar/networks/2/volumes/lnd/platform/data/chain/bitcoin/regtest/admin.macaroon
```

Fill `.env` (copied from `.env.example`) with:

```
LND_REST_HOST=https://127.0.0.1:8082
LND_TLS_CERT_PATH=/Users/<you>/.polar/networks/2/volumes/lnd/platform/tls.cert
LND_MACAROON_HEX=<output of the xxd command>
```

Polar passes LND flags on the command line rather than in an `lnd.conf`.
`--accept-keysend` is set, and the `invoicesrpc` and `routerrpc` sub-servers
are compiled into LND release builds. To confirm on a node:

```
docker inspect polar-n2-platform --format '{{join .Config.Cmd " "}}'
```

## Funding and channels

Required topology, all confirmed:

| Channel            | Capacity       |
|--------------------|----------------|
| poster -> platform | 1,000,000 sats |
| platform -> worker | 1,000,000 sats |

In Polar: **Deposit** 1,000,000+ sats on poster and platform, mine 6 blocks,
then open the two channels from poster and platform respectively, and mine 6
more blocks.

Do not mine blocks during a demo. A hold invoice's HTLC is force-cancelled by
LND once the chain reaches its CLTV expiry (`HOLD_INVOICE_CLTV_EXPIRY`).

## Checks

```
pnpm lnd:check
```

Prints the platform node's alias, pubkey and channels, and fails unless the
node is on regtest, synced, and has two active channels.

```
pnpm lnd:hodl-smoke
```

Creates a 1,000-sat hold invoice on the platform node and prints it. Pay it
from the poster node in Polar. The script reports ACCEPTED and then asks
whether to settle or cancel. Run it once each way: settle should raise the
platform's channel balance by 1,000 sats and complete the poster's payment;
cancel should fail the poster's payment and leave both balances unchanged.

Routing check (Phase 0 acceptance): create an invoice on worker and pay it from
poster in the Polar UI. Success proves poster -> platform -> worker routing.

## Funding script

The Phase 3 integration tests pay hold invoices from the poster node through
its REST API using the poster node's admin macaroon. That script is documented here once
it exists.
