import os
from dotenv import load_dotenv

# Load environment variables from .env file or dot_env_microtutor.txt
load_dotenv("dot_env_microtutor.txt")


def _env_truthy(name: str, default: str = "false") -> bool:
    return os.getenv(name, default).lower() in {"1", "true", "yes", "on"}


class Config:
    """Environment-driven settings for src_simplified."""

    USE_AZURE_OPENAI: bool = _env_truthy("USE_AZURE_OPENAI")

    AZURE_OPENAI_ENDPOINT: str = os.getenv("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_API_KEY: str = os.getenv("AZURE_OPENAI_API_KEY", "")
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-12-01-preview")
    AZURE_OPENAI_DEPLOYMENT_NAME: str = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-5-mini")

    OPENAI_API_KEY: str | None = os.getenv("OPENAI_API_KEY")
    PERSONAL_OPENAI_MODEL: str = os.getenv("PERSONAL_OPENAI_MODEL", "gpt-5-mini")

    # Chat model name passed to the SDK: Azure deployment ID or OpenAI model id.
    MODEL_NAME: str = os.getenv("MODEL_NAME") or (
        AZURE_OPENAI_DEPLOYMENT_NAME if USE_AZURE_OPENAI else PERSONAL_OPENAI_MODEL
    )
    TEACHING_MODEL_NAME: str = os.getenv("TEACHING_MODEL_NAME") or MODEL_NAME

    CSV_PATH = os.getenv("CSV_PATH", "data/pathogen_history_domains_complete.csv")
    FEEDBACK_INDEX_DIR = os.getenv("FEEDBACK_INDEX_DIR", "data/feedback_auto")
    FEEDBACK_INDEXING_ENABLED = _env_truthy("FEEDBACK_INDEXING_ENABLED")


config = Config()

