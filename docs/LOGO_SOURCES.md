# University logo sources

Logos live in `public/logos/universities/<institution_slug>.png` and are linked
from `institutions.logo_url` as `/logos/universities/<institution_slug>.png`
(19 hubs, all `<30 KB`). The Admission Hub UI renders the logo in a soft teal
tile and falls back to a initials badge when `logo_url` is NULL or the image
fails to load; no logo is invented locally.

## Sources

| slug | source file page | license / status | processing |
| --- | --- | --- | --- |
| university-of-dhaka | `https://en.wikipedia.org/wiki/File:Dhaka_University_logo.svg` | Fair use (en.wikipedia) | SVG → PNG via `rsvg-convert -w 200` |
| university-of-rajshahi | `https://commons.wikimedia.org/wiki/File:%E0%A6%B0%E0%A6%BE%E0%A6%9C%E0%A6%B6%E0%A6%BE%E0%A6%B9%E0%A7%80_%E0%A6%AC%E0%A6%BF%E0%A6%B6%E0%A7%8D%E0%A6%AC%E0%A6%BF%E0%A6%A6%E0%A7%8D%E0%A6%AF%E0%A6%BE%E0%A6%B2%E0%A6%AF%E0%A6%BC%E0%A7%87%E0%A6%B0_%E0%A6%B2%E0%A7%8B%E0%A6%97%E0%A7%8B.svg` | Public domain | SVG → PNG via `rsvg-convert -w 200` |
| university-of-chittagong | `https://en.wikipedia.org/wiki/File:University_of_Chittagong_logo.svg` | Fair use (en.wikipedia) | SVG → PNG via `rsvg-convert -w 200` |
| jahangirnagar-university | `https://en.wikipedia.org/wiki/File:Jahangirnagar_University_Logo.svg` | Fair use (en.wikipedia) | SVG → PNG via `rsvg-convert -w 200` |
| jagannath-university | `https://en.wikipedia.org/wiki/File:Logo_of_Jagannath_University.svg` | Fair use (en.wikipedia) | SVG → PNG via `rsvg-convert -w 200` |
| khulna-university | `https://en.wikipedia.org/wiki/File:Khulna_University_Logo.svg` | Fair use (en.wikipedia) | SVG → PNG via `rsvg-convert -w 200` |
| islamic-university-bangladesh | `https://en.wikipedia.org/wiki/File:Islamic_University,_Bangladesh_logo.svg` | Fair use (en.wikipedia) | SVG → PNG via `rsvg-convert -w 200` |
| university-of-barishal | `https://en.wikipedia.org/wiki/File:Barishal_University_logo.svg` | Fair use (en.wikipedia) | SVG → PNG via `rsvg-convert -w 200` |
| begum-rokeya-university-rangpur | `https://commons.wikimedia.org/wiki/File:BRUR_Logo.svg` | CC BY-SA 4.0 | SVG → PNG via `rsvg-convert -w 200` |
| rabindra-university-bangladesh | `https://commons.wikimedia.org/wiki/File:Rabindra_University_Logo.svg` | Public domain | SVG → PNG via `rsvg-convert -w 200` |
| comilla-university | `https://en.wikipedia.org/wiki/File:Logo_of_Comilla_University.png` | Fair use (en.wikipedia) | PNG 120 px thumbnail |
| gopalganj-science-and-technology-university | `https://en.wikipedia.org/wiki/File:GSTU_Logo.png` | Fair use (en.wikipedia) | PNG 120 px thumbnail |
| noakhali-science-and-technology-university | `https://en.wikipedia.org/wiki/File:Logo_of_Noakhali_Science_and_Technology_University.gif` | Fair use (en.wikipedia) | GIF 120 px thumbnail → PNG (transparency preserved) |
| pabna-university-of-science-and-technology | `https://en.wikipedia.org/wiki/File:PUST_Logo.png` | Fair use (en.wikipedia) | PNG 120 px thumbnail |
| patuakhali-science-and-technology-university | `https://en.wikipedia.org/wiki/File:Patuakhali_Science_and_Technology_University_logo.png` | Fair use (en.wikipedia) | PNG 120 px thumbnail |
| mawlana-bhashani-science-and-technology-university | `https://commons.wikimedia.org/wiki/File:Logo_Of_MBSTU.png` | CC0 | PNG 120 px thumbnail |
| jashore-university-of-science-and-technology | `https://commons.wikimedia.org/wiki/File:Jashore_University_Of_Science_and_Technology_logo.png` | CC0 | PNG 120 px thumbnail |
| shahjalal-university-of-science-and-technology | `https://en.wikipedia.org/wiki/File:Shahjalal_University_of_Science_and_Technology_logo.png` | Fair use (en.wikipedia) | PNG 120 px thumbnail |
| jatiya-kabi-kazi-nazrul-islam-university | `https://en.wikipedia.org/wiki/File:Jatiya_Kabi_Kazi_Nazrul_Islam_University_Logo.png` | Fair use (en.wikipedia) | PNG 120 px thumbnail |

## Missing

None: all 19 universities in the hub catalog have a file. If a future
institution is added and no Wikimedia file is found, set `logo_url = NULL` and
leave the file out so the UI uses the initials badge.
