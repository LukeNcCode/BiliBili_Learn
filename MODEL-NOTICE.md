# Local semantic model notice

BiliBili Learning Version bundles the INT8 ONNX conversion of
`BAAI/bge-small-zh-v1.5` for local subject classification.

- Source model: https://huggingface.co/BAAI/bge-small-zh-v1.5
- ONNX conversion: https://huggingface.co/Xenova/bge-small-zh-v1.5
- License: MIT
- Purpose: classify user-visible video metadata into learning subjects
- Runtime: Transformers.js and ONNX Runtime Web

The model runs inside a Web Worker on the user's device. Video titles,
descriptions, categories, and tags are not sent to a model API.
