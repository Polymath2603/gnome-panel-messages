# Panel Messages

A GNOME Shell extension with CLI control — show a customizable message in your
top panel. Instead of spamming notifications, your background processes (builds,
tests, cron jobs) update the panel silently. One glance tells you the status.

> 🛠️ **Vibe-coded.** Built with AI assistance; no formal review. Tested on
> GNOME Shell; works as described.

## Quick start

```bash
git clone https://github.com/Polymath2603/gnome-panel-messages
cd gnome-panel-messages
./install.sh
gnome-extensions enable panel-messages@leonardo.local
# restart GNOME Shell: Alt+F2, r
```

## Usage

```bash
panel-message "Hello world"             # set message
panel-message --alert "URGENT"          # set + flash red bold
panel-message --color=red --bold "⚠"    # persistent styling
panel-message -c                         # clear
panel-message --help                     # full usage
```

## Features

| Feature | CLI | Panel (click) | Settings GUI |
|---------|:---:|:-------------:|:------------:|
| Set message text | ✅ | ✅ | — |
| Persistent colour + bold | ✅ | — | ✅ |
| Alert flash (red bold → fade) | ✅ | — | — |
| Panel position (5 zones) | ✅ | — | ✅ |
| Ordering index | ✅ | — | ✅ |
| Default/placeholder text | ✅ | — | ✅ |
| Quiet mode (no stdout) | ✅ | — | — |

## Known issues / Limitations

- GNOME Shell only; no other desktop support.
- Requires extension reload after install.

## Support

If this extension earns its place in your panel, donations are appreciated:

| | |
|---|---|
| PayPal | `paypal.com/ncp/payment/W78F6W4TXZ4CS` |
| Binance | `1011264323` |
| Bybit | `467077834` |
| TRC20 | `TMW5uSDN6sMUBNirMoqY1icpsfa7GhPZfK` |
| BEP20/ERC20 | `0x7a8887c2ac3e596f6170c9e28b44e6b6d025c854` |
| LTC | `LVswXiD6Vd2dejXcgZ7a` |
| TON | `UQAllRezWgHi3LPrSwyvAb4zazIph6j6goU7lMaqcFWFBxVH` |
| BTC | `1rSX6BDN1nqDMyBHqceySkZSs6PHUP23m` |
| SOL | `d8RonhC8oEHssrQjN1Y4UWHnd6MMP33XGCKtfNL4j59` |

## Apology

No screenshots of the panel in action are included.

## License

GPL-2.0
