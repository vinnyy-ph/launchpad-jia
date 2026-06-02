import { useEffect, useState } from "react";
import Markdown from "react-markdown";
import SkillTagInput from "../CandidateComponents/SkillTagInput";

export default function CVSectionItem(props: any) {
  const { data, saveCV } = props;

  const [isEditing, setIsEditing] = useState(false);

  const [content, setContent] = useState(data.content);
  const [skills, setSkills] = useState<string[]>([]);

  useEffect(() => {
    setContent(data.content);
    
    // Parse skills from markdown content if this is the Skills section
    if (data.name === "Skills" && data.content) {
      const parsedSkills = parseSkillsFromMarkdown(data.content);
      setSkills(parsedSkills);
    }
  }, [data]);

  // Parse skills from markdown format (bullet points or comma-separated)
  const parseSkillsFromMarkdown = (markdownContent: string): string[] => {
    if (!markdownContent) return [];
    
    // Common section headers to filter out
    const sectionHeaders = [
      'skills',
      'technical skills',
      'soft skills',
      'hard skills',
      'core competencies',
      'expertise',
      'proficiencies',
      'technologies',
      'tools',
      'languages',
      'frameworks'
    ];
    
    // Remove markdown formatting and split by common delimiters
    const cleaned = markdownContent
      .replace(/^[-*+]\s+/gm, '') // Remove bullet points (-, *, +)
      .replace(/^\d+\.\s+/gm, '') // Remove numbered lists
      .replace(/[#*_~`]/g, '') // Remove markdown formatting
      .replace(/^>\s+/gm, '') // Remove blockquotes
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Remove markdown links, keep text
    
    // Split by newlines or commas
    const skills = cleaned
      .split(/[\n,]/)
      .map(skill => skill.trim())
      .filter(skill => {
        // Filter out empty strings
        if (skill.length === 0) return false;
        
        // Filter out section headers
        const lowerSkill = skill.toLowerCase();
        if (sectionHeaders.includes(lowerSkill)) return false;
        
        // Filter out very short entries (likely noise)
        if (skill.length < 2) return false;
        
        // Filter out entries that are just special characters
        if (/^[^a-zA-Z0-9]+$/.test(skill)) return false;
        
        return true;
      });
    
    return skills;
  };

  // Convert skills array back to markdown format
  const convertSkillsToMarkdown = (skillsList: string[]): string => {
    return skillsList.map(skill => `- ${skill}`).join('\n');
  };

  const handleSkillsChange = (newSkills: string[]) => {
    setSkills(newSkills);
    const markdownContent = convertSkillsToMarkdown(newSkills);
    setContent(markdownContent);
  };

  return (
    <>
      <div className="card shadow-1">
        <div className="card-header">
          <h3 className="mb-0 mr-auto">
            <i className="la la-edit text-primary mr-2" />{" "}
            <span className="cv-section-name">{data.name}</span>
          </h3>

          {props.editable && (
            <button
              className={`btn btn-muted ${
                isEditing ? "btn-primary editing-now" : ""
              }`}
              onClick={() => {
                if (isEditing) {
                  setTimeout(() => {
                    saveCV();
                  }, 300);
                }

                setIsEditing(!isEditing);
              }}
            >
              <i className="la la-edit mr-2" />{" "}
              {isEditing ? "Done Editing" : "Edit"}
            </button>
          )}
        </div>

        <div className="card-body">
          {isEditing ? (
            data.name === "Skills" ? (
              <SkillTagInput
                skills={skills} 
                onSkillsChange={handleSkillsChange} 
              />
            ) : (
              <div className="markdown-body">
                <textarea
                  className="form-control"
                  defaultValue={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Enter your content here"
                />
              </div>
            )
          ) : (
            <div className="markdown-body cv-section-content">
              {data.name === "Skills" && skills.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {skills.map((skill, index) => (
                    <span 
                      key={index}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#f5f7fa',
                        border: '1px solid #e0e4e9',
                        borderRadius: '20px',
                        fontSize: '14px',
                        color: '#181d27'
                      }}
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <Markdown>{content ? content : data.content}</Markdown>
              )}
            </div>
          )}

          {/* pure markdown content is kept here */}
          <textarea
            className="form-control d-none markdown-cv-content"
            value={content}
            onChange={(e) => {}}
            placeholder="Enter your content here"
          />

          {!data.content && !isEditing && !content && (
            <div className="markdown-body cv-section-content">
              <p>
                No content found. Click "Edit" to add content for this section.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
