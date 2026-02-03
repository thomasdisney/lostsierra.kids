class StripReasoningEffortForXAI:
    """
    Removes params that xAI rejects when requests come from clients that send them
    (ex: Claude Code sending reasoningEffort).
    """

    def _strip(self, data):
        if isinstance(data, dict):
            data.pop("reasoningEffort", None)
            data.pop("reasoning_effort", None)
            for v in data.values():
                self._strip(v)
        elif isinstance(data, list):
            for v in data:
                self._strip(v)

    async def async_pre_call_hook(self, user_api_key_dict, cache, data, call_type):
        self._strip(data)
        return data

proxy_handler_instance = StripReasoningEffortForXAI()