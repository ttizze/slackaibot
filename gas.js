function doPost(e) {
  //受信データをパース
  const json = JSON.parse(e.postData.getDataAsString());
  
  //Challenge認証用
  if (json.type === 'url_verification') {
    return ContentService.createTextOutput(json.challenge);
  }

  //イベント再送回避
  //キャッシュに積まれていれば処理済
  //未処理の場合はキャッシュに積む（有効期間5m）
  const event_id = json.event_id;
  const cache = CacheService.getScriptCache();
  const isProcessed = cache.get(event_id);
  if (isProcessed)　return;
  cache.put(event_id, true, 601);

  //サブタイプが設定されたイベント
  if('subtype' in json.event) return;

  //ChatGPTBotが送信した場合
  //ChatGPTで応答メッセージを作成し、Slackに送信する
  const botId = PropertiesService.getScriptProperties().getProperty('slackBotId');
  if (json.event && json.event.user !== botId) {
    const channel = json.event.channel;
    const text = json.event.text;
    const message = requestChatGPT(text);
    sendSlack(channel, message);
  }

  return;
}

//SlackBotsを通してメッセージを送信する
function sendSlack(channel, message) {
  const slackToken = PropertiesService.getScriptProperties().getProperty('slackBotToken');
  const slackApp = SlackApp.create(slackToken);
  slackApp.postMessage(channel, message);
}

//ChatGPTにテキストを送信し、応答メッセージを取得する
function requestChatGPT(message) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('openApiKey');
  const apiUrl = 'https://api.openai.com/v1/chat/completions';
  
  //リクエストデータの設定
  const headers = {
    'Authorization':'Bearer '+ apiKey,
    'Content-type': 'application/json'
  };
  const options = {
    'headers': headers, 
    'method': 'POST',
    'payload': JSON.stringify({
      'model': 'gpt-3.5-turbo',
      'max_tokens' : 256,
      "temperature": 0,
      'messages':  [
                  { role: "system", content: "あなたはMAD-AIです。株式会社MADのAIです。" },
                  { role: "user", content: message }
                  ]})
  };

  //リクエストを送信し、結果取得
  const response = JSON.parse(UrlFetchApp.fetch(apiUrl, options).getContentText());
  const resMessage = response.choices[0].message.content;
  return resMessage;
}
