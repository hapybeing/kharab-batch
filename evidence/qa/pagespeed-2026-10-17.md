# PageSpeed Insights (Lighthouse 13.5.0, mobile, emulated Moto G Power), run on Google's servers 17 Oct 2026 ~19:07 IST

The keyless PSI API returned "API has not been used in project … or it is disabled" from the sandbox, so the runs were made in the pagespeed.web.dev UI.

| URL | Perf | A11y | BP | SEO | FCP | LCP | TBT | CLS | SI | Report |
|---|---|---|---|---|---|---|---|---|---|---|
| https://hapybeing.github.io/kharab-batch/ | 100 | 100 | 96 | 100 | 1.5 s | 1.5 s | 0 ms | 0.022 | 1.5 s | https://pagespeed.web.dev/analysis/https-hapybeing-github-io-kharab-batch/96uh60b5td?strategy=mobile |
| https://hapybeing.github.io/kharab-batch/#/b/SR13 (result deep link) | 96 | 100 | 96 | 100 | 1.5 s | 2.4 s | 40 ms | 0.022 | 3.8 s | https://pagespeed.web.dev/analysis/https-hapybeing-github-io-kharab-batch/57d2po2pkt?form_factor=mobile#/b/SR13&strategy=mobile |
| https://hapybeing.github.io/kharab-batch/?embed=1&lang=en&batch=SR13 (result card via query string) | 99 | 100 | 100 | 100 | 1.1 s | 1.7 s | 0 ms | 0.049 | 2.2 s | https://pagespeed.web.dev/analysis/https-hapybeing-github-io-kharab-batch/7e7oe8t1qa?strategy=mobile&form_factor=mobile |

No failing accessibility audits on any of the three. Caveat: PSI's URL box shows the hash route without its `#/b/SR13` part, so it is not certain row 2 measured the result screen; row 3 (query string, kept verbatim) renders the same result card and is the reliable result-page number.
