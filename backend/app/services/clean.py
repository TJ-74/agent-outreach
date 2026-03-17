"""
Email body cleaning utilities.

Pipeline:
  1. HTML → plain text (strip tags)
  2. Remove quoted reply blocks (Outlook / Gmail "On … wrote:" patterns)
  3. Remove email signatures (-- delimiter, closing salutations)
  4. Remove unsubscribe / opt-out sentences and URLs
  5. Collapse excess whitespace
"""
import re
from html.parser import HTMLParser


# ─── HTML → plain text ────────────────────────────────────────


class _HTMLToText(HTMLParser):
    _BLOCK_TAGS = {"p", "div", "tr", "h1", "h2", "h3", "h4", "h5", "h6", "li", "blockquote"}
    _SKIP_TAGS = {"script", "style", "head", "noscript"}

    def __init__(self) -> None:
        super().__init__()
        self._text: list[str] = []
        self._skip: str | None = None

    def handle_starttag(self, tag: str, attrs: list) -> None:
        tag = tag.lower()
        if tag in self._SKIP_TAGS:
            self._skip = tag
        elif tag == "br":
            self._text.append("\n")
        elif tag in self._BLOCK_TAGS:
            self._text.append("\n")
        elif tag == "li":
            self._text.append("\n• ")

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() == self._skip:
            self._skip = None

    def handle_data(self, data: str) -> None:
        if self._skip is None:
            self._text.append(data)

    def get_text(self) -> str:
        return "".join(self._text)


def html_to_text(html: str) -> str:
    """Convert HTML email body to plain text."""
    stripper = _HTMLToText()
    try:
        stripper.feed(html)
    except Exception:
        pass
    return stripper.get_text()


# ─── Quote / reply removal ────────────────────────────────────

# "On Mon, 1 Jan 2025, John wrote:" (Gmail / Apple Mail style)
_RE_ON_WROTE = re.compile(
    r"\bOn\s+.{10,120}?wrote\s*:\s*$",
    re.MULTILINE | re.IGNORECASE,
)

# "From: ...\nSent: ...\nTo: ...\nSubject: ..." (Outlook forwarded block)
_RE_OUTLOOK_FORWARD = re.compile(
    r"^(?:From|Sent|To|Subject)\s*:.*$",
    re.MULTILINE | re.IGNORECASE,
)

# Outlook horizontal separator  ________________________________
_RE_HR = re.compile(r"_{8,}|-{8,}|={8,}", re.MULTILINE)

# Lines starting with ">" (standard quote marker)
_RE_QUOTE_LINE = re.compile(r"^>.*$", re.MULTILINE)

# "-----Original Message-----"
_RE_ORIGINAL_MSG = re.compile(
    r"-{3,}\s*(?:Original\s+Message|Forwarded\s+Message)\s*-{3,}",
    re.IGNORECASE,
)


def _strip_quoted_replies(text: str) -> str:
    """
    Find the earliest indicator of a quoted reply and truncate there.
    This handles Outlook, Gmail, and Apple Mail styles.
    """
    earliest = len(text)

    for pattern in (_RE_ON_WROTE, _RE_OUTLOOK_FORWARD, _RE_HR, _RE_ORIGINAL_MSG):
        m = pattern.search(text)
        if m and m.start() < earliest:
            earliest = m.start()

    text = text[:earliest]

    # Also strip any remaining "> " lines
    text = _RE_QUOTE_LINE.sub("", text)
    return text


# ─── Signature removal ────────────────────────────────────────

# Standard -- delimiter (RFC 3676)
_RE_SIG_DASH = re.compile(r"\n--\s*\n.*", re.DOTALL)

# Common closing salutations followed by name/company
_RE_SIG_CLOSING = re.compile(
    r"\n(?:Best(?: regards)?|Kind regards|Warm regards|Regards|Thanks|Thank you|"
    r"Sincerely|Cheers|Yours truly|Best wishes|Take care)[,.]?\s*\n.*",
    re.DOTALL | re.IGNORECASE,
)

# Phone / email signature lines (e.g. "T: +1 555…" or "www.company.com")
_RE_SIG_CONTACT = re.compile(
    r"\n(?:Tel|Phone|Cell|Mobile|Fax|T|P)\s*:.*$",
    re.MULTILINE | re.IGNORECASE,
)


def _strip_signature(text: str) -> str:
    # -- delimiter takes highest priority
    m = _RE_SIG_DASH.search(text)
    if m:
        return text[: m.start()]

    # Closing salutation – but only if it's in the last 40% of the text
    # to avoid false positives in the body.
    cutoff = int(len(text) * 0.60)
    m = _RE_SIG_CLOSING.search(text, cutoff)
    if m:
        return text[: m.start()]

    return text


# ─── Unsubscribe / legal footer removal ─────────────────────

_RE_UNSUB = re.compile(
    r"(?:https?://\S*(?:unsubscribe|opt.?out|manage.?pref|remove\b)\S*|"
    r"(?:to\s+)?(?:unsubscribe|opt\s+out|stop\s+receiving|remove\s+yourself)[^\n]*)",
    re.IGNORECASE,
)

_RE_LEGAL_FOOTER = re.compile(
    r"\n(?:This\s+(?:email|message|communication)\s+(?:is\s+)?(?:confidential|privileged)|"
    r"CONFIDENTIALITY\s+NOTICE|DISCLAIMER)[^\n]*(?:\n[^\n]+)*",
    re.IGNORECASE,
)


def _strip_footers(text: str) -> str:
    text = _RE_UNSUB.sub("", text)
    text = _RE_LEGAL_FOOTER.sub("", text)
    return text


# ─── Whitespace normalisation ─────────────────────────────────

_RE_EXCESS_WS = re.compile(r"\n{3,}")
_RE_TRAILING_WS = re.compile(r"[ \t]+$", re.MULTILINE)


# ─── Public API ───────────────────────────────────────────────

def clean_body(html: str) -> str:
    """
    Full cleaning pipeline for an email body.

    Input  : raw HTML from Outlook (body.content)
    Output : clean plain-text suitable for AI summarisation

    Steps:
      1. HTML → plain text
      2. Remove quoted replies (Outlook / Gmail / Apple Mail)
      3. Remove email signature
      4. Remove unsubscribe / legal footers
      5. Collapse whitespace
    """
    if not html:
        return ""

    text = html_to_text(html)
    text = _strip_quoted_replies(text)
    text = _strip_signature(text)
    text = _strip_footers(text)
    text = _RE_TRAILING_WS.sub("", text)
    text = _RE_EXCESS_WS.sub("\n\n", text)
    return text.strip()
