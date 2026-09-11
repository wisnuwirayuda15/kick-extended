import { gmFetch } from "./gm-fetch.ts";
import { isVersionGreater } from "./storage.ts";

// Memoised so the GitHub API is hit once per page, not once per player mount.
let latestReleasePromise = null;

export async function getLatestReleaseAsync() {
  try {
    const response = await gmFetch(
      "https://api.github.com/repos/Enmn/KickNoSub/releases/latest",
      {
        headers: { Accept: "application/vnd.github+json" },
      },
    );
    if (!response.ok) return null;
    const data = response.json();
    return {
      tagName: data.tag_name,
      htmlUrl: data.html_url,
      name: data.name,
    };
  } catch (e) {
    return null;
  }
}

export function getLatestReleaseInfo() {
  if (latestReleasePromise) return latestReleasePromise;

  latestReleasePromise = getLatestReleaseAsync()
    .then((release) => {
      const currentVersion = GM_info.script.version;
      if (
        release?.tagName &&
        release?.htmlUrl &&
        isVersionGreater(release.tagName, currentVersion)
      ) {
        return release;
      }
      return null;
    })
    .catch(() => null);

  return latestReleasePromise;
}
