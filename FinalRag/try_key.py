import requests
 
 
def chat(messages):
    url = "https://ai-api-dev.dentsu.com/openai/deployments/gpt-4/chat/completions?api-version=2024-10-21"
    #url = "https://ai-api-dev.dentsu.com/openai/deployments/GPT35Turbo16k/chat/completions?api-version=2024-10-21"
 
    headers  = {
        "x-service-line":"cxm",
        "x-brand":"dentsu",
        "x-project":"aiassistant",
        "api-version":"v15",
        "Ocp-Apim-Subscription-Key":"5e96408637cf4ad29534c2e8aac82004"
    }
 
    body = {
        "messages": messages
    }
 
 
    r=requests.post(url=url, headers=headers , json=body)
    print(r)
    return r.json().get("choices")[0].get("message").get("content")
 
 
msg = [
    {
        "content": "you are a helpful assistant for a chef only answer questions about food",
        "role": "system",
        "name": "string"
    }
]
 
while(True):
    userQuery = input("Question : ")
    msg.append(
        {
        "content": userQuery,
        "role": "user",
        "name": "string"
        }
    )
    assi = chat(msg)
    msg.append(
        {
        "content": assi,
        "role": "assistant",
        "name": "string"
        }  
    )
    print(f"answer : {assi}")