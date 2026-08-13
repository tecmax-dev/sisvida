import requests
import os

token = os.environ.get("CHATWOOT_TOKEN_89e7585e_7bce_4e58_91fa_c37080d1170d")
url = "https://chat.zapresponde.app/api/v1/accounts/1/contacts"
headers = {"api_access_token": token}

for page in range(1, 11):
    print(f"Checking page {page}...")
    r = requests.get(url, headers=headers, params={"page": page})
    if r.status_code != 200:
        print(f"Error {r.status_code}: {r.text}")
        break
    data = r.json()
    contacts = data.get("payload", [])
    if not contacts:
        print("No more contacts.")
        break
    for c in contacts:
        phone = str(c.get("phone_number", ""))
        if "8633535" in phone:
            print(f"FOUND on page {page}!")
            print(c)
            # exit(0)
    if len(contacts) < 15:
        print("End of results.")
        break
