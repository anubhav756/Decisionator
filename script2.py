import pandas as pd

DATASET_URI = (
    "https://raw.githubusercontent.com/anubhav756/Decisionator/main/quotes.csv"
)

df = pd.read_csv(DATASET_URI)
df = df.loc[:, ["Quote", "Character", "Movie", "Reference", "Tag"]]
df = df.dropna()
print(df)
