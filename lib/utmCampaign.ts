// Pulls the utm_campaign value back out of a description's tagged link (see
// lib/utm.ts, which is what puts it there in the first place) — this is the
// key used to match a post+platform against GA4's sessionCampaignName.
const UTM_CAMPAIGN_REGEX = /[?&]utm_campaign=([^&\s]+)/i;

export function extractUtmCampaign(text: string): string | null {
  const match = text.match(UTM_CAMPAIGN_REGEX);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface UtmInfo {
  url: string;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  content: string | null;
}

const URL_REGEX = /https?:\/\/\S+/gi;

// Finds every UTM-tagged link in free text (a post's caption) and reads
// back each one's utm_ params — used for the "see all tags" overview, where
// extractUtmCampaign alone (just the one param GA4 matching needs, and only
// the first match, since every placement of the same post+platform shares
// one campaign by convention) isn't enough — this view's whole point is
// listing every individual tagged link, including a caption that happens to
// carry more than one.
export function extractAllUtmInfo(text: string): UtmInfo[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];
  const results: UtmInfo[] = [];
  for (const raw of matches) {
    try {
      const url = new URL(raw);
      if (!url.searchParams.has("utm_campaign") && !url.searchParams.has("utm_source")) continue;
      results.push({
        url: raw,
        source: url.searchParams.get("utm_source"),
        medium: url.searchParams.get("utm_medium"),
        campaign: url.searchParams.get("utm_campaign"),
        content: url.searchParams.get("utm_content"),
      });
    } catch {
      continue;
    }
  }
  return results;
}
