import Markdown from "react-markdown";

export default function CustomMarkdown({ content }: { content: string }) {
    return (
        <div className="markdown-content">
            <Markdown>{content}</Markdown>
        </div>
    )
}