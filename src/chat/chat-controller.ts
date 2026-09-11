import { gmFetch } from "../lib/gm-fetch.ts";

export class ChatController {
  declare channelId: any;
  declare videoStartTime: any;
  declare container: any;
  declare messages: any[];
  declare videoElement: any;
  declare activeSessionId: number;
  declare chatList: any;
  declare lastRenderedMsgId: any;

  constructor(channelId, videoStartTime, container) {
    this.channelId = channelId;
    this.videoStartTime = videoStartTime;
    this.container = container;
    this.messages = [];
    this.videoElement = null;
    this.activeSessionId = 0;
  }

  stop() {
    // fetchLoop runs `while (this.activeSessionId === sessionId)`, so
    // bumping the id is what actually ends it.
    this.activeSessionId++;
    this.videoElement = null;
  }

  init(initialVideoElement = null) {
    if (this.container) {
      this.container.innerHTML = `
              <div style="height:100%;display:flex;flex-direction:column;font-family:Inter,sans-serif;">
                  <div id="kick-unlocker-chat-list" style="flex:1;overflow-y:auto;padding:10px;font-size:13px;color:#fff;">
                      <br><div style="text-align:center;color:#888;">Connecting...</div>
                  </div>
              </div>`;
      this.chatList = this.container.querySelector(
        "#kick-unlocker-chat-list",
      );
    }
    if (initialVideoElement) this.connectVideo(initialVideoElement);
    this.fetchLoop(this.activeSessionId);
  }

  connectVideo(videoElement) {
    this.videoElement = videoElement;
    videoElement.addEventListener("timeupdate", () =>
      this.updateUI(videoElement.currentTime),
    );
    videoElement.addEventListener("seeking", () => {
      this.activeSessionId++;
      this.messages = [];
      if (this.chatList)
        this.chatList.innerHTML =
          '<br><div style="text-align:center;color:#888;">Syncing...</div>';
      this.fetchLoop(this.activeSessionId);
    });
  }

  parseContent(content) {
    if (!content) return "";
    return content.replace(
      /\[emote:(\d+):([^\]]+)\]/g,
      (match, id, name) =>
        `<img src="https://files.kick.com/emotes/${id}/fullsize" alt="${name}" title="${name}" style="height:1.8em;vertical-align:middle;display:inline-block;margin:0 2px;">`,
    );
  }

  async fetchLoop(sessionId) {
    let currentCursor = null;
    while (this.activeSessionId === sessionId) {
      try {
        let url = `https://kick.com/api/v2/channels/${this.channelId}/messages`;
        if (currentCursor) url += `?cursor=${currentCursor}`;
        else {
          let targetTime = this.videoStartTime;
          if (this.videoElement)
            targetTime = new Date(
              this.videoStartTime.getTime() +
                this.videoElement.currentTime * 1000,
            );
          url += `?start_time=${targetTime.toISOString()}`;
        }
        const res = await gmFetch(url);
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }
        const data = res.json();
        if (this.activeSessionId !== sessionId) break;

        const msgs = data.messages || (data.data && data.data.messages) || [];
        if (msgs.length) {
          msgs.forEach((msg) => {
            if (!this.messages.some((m) => m.id === msg.id))
              this.messages.push(msg);
          });
          this.messages.sort(
            (a, b) => (new Date(a.created_at) as any) - (new Date(b.created_at) as any),
          );
          if (this.videoElement) this.updateUI(this.videoElement.currentTime);
        }
        currentCursor =
          data.cursor || (data.data && data.data.cursor) || data.next_cursor;
        if (!currentCursor) {
          currentCursor = null;
          await new Promise((r) => setTimeout(r, 2000));
        } // Retry/Recovery
        else {
          if (this.messages.length && this.videoElement) {
            const lastT = new Date(
              this.messages[this.messages.length - 1].created_at,
            ).getTime();
            const vidT =
              this.videoStartTime.getTime() +
              this.videoElement.currentTime * 1000;
            if (lastT > vidT + 60000)
              await new Promise((r) => setTimeout(r, 1000));
            else await new Promise((r) => setTimeout(r, 50));
          } else await new Promise((r) => setTimeout(r, 50));
        }
      } catch (e) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }

  updateUI(cwdSeconds) {
    if (!this.chatList) return;
    const absTime = this.videoStartTime.getTime() + cwdSeconds * 1000;
    let limit = -1;
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (new Date(this.messages[i].created_at).getTime() <= absTime) {
        limit = i;
        break;
      }
    }
    if (limit === -1) return;
    const subset = this.messages.slice(Math.max(0, limit - 75), limit + 1);
    const lastM = subset[subset.length - 1];
    if (
      !lastM ||
      (this.lastRenderedMsgId === lastM.id && subset.length >= 50)
    )
      return;

    this.chatList.innerHTML = subset
      .map(
        (msg) => `
          <div style="margin-bottom:4px;line-height:1.4;word-wrap:break-word;">
              <span style="color:${msg.sender.identity?.color || "#53fc18"};font-weight:bold;margin-right:5px;">${msg.sender.username}:</span>
              <span style="color:#efeff1;">${this.parseContent(msg.content)}</span>
          </div>`,
      )
      .join("");
    this.chatList.scrollTop = this.chatList.scrollHeight;
    this.lastRenderedMsgId = lastM.id;
  }
}
