// TODO (Job Portal) - Check API

"use client";

import styles from "@/lib/styles/screens/manageCV.module.scss";
import { assetConstants } from "@/lib/utils/constantsV2";
import { checkFile, formatFileSize } from "@/lib/utils/helpersV2";
import { useAppContext } from "@/lib/context/ContextV2";
import { CORE_API_URL } from "@/lib/Utils";
import axios from "axios";
import Markdown from "react-markdown";
import { useEffect, useRef, useState } from "react";
import { api } from "../../utils/apiClient";
import SkillTagInput from "../CandidateComponents/SkillTagInput";
import { SkillTag } from "../CandidateComponents/SkillTag";
import Image from "next/image";
import { Textarea } from "../ui";

export default function () {
  const fileInputRef = useRef(null);
  const [buildingCV, setBuildingCV] = useState(false);
  const [digitalCV, setDigitalCV] = useState(null);
  const [editingCV, setEditingCV] = useState(null);
  const [file, setFile] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isHover, setIsHover] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);
  const [userCV, setUserCV] = useState(null);
  const [hasPersistedCV, setHasPersistedCV] = useState(false);
  const [skills, setSkills] = useState<string[]>([]);
  const [initialSkills, setInitialSkills] = useState<string[]>([]);
  const MAX_SKILLS = 60;
  const { user, setModalType, setToasterType } = useAppContext();
  const cvSections = [
    "Introduction",
    "Current Position",
    "Contact Info",
    "Skills",
    "Experience",
    "Education",
    "Projects",
    "Certifications",
    "Awards",
  ];

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

  const formatCVBySections = (digitalCVSections: any[] = []) => {
    const formattedCV = {};
    const sectionsByName = new Map(
      (Array.isArray(digitalCVSections) ? digitalCVSections : [])
        .filter((section) => section && typeof section === "object")
        .map((section) => [String(section?.name || "").trim(), section])
    );

    cvSections.forEach((section, index) => {
      const namedSection = sectionsByName.get(section);
      const indexedSection = digitalCVSections[index];
      const selected = namedSection || indexedSection;
      const content =
        selected?.content == null ? "" : String(selected.content).trim();
      formattedCV[section] = content;
    });

    return formattedCV;
  };

  const syncParsedSkillsToMetadata = async (skillsList: string[]) => {
    if (!user?.email || !skillsList || skillsList.length === 0) return;

    try {
      await api.post("/api/sync-candidate-skills", {
        candidateEmail: user.email,
        addedSkills: skillsList,
        removedSkills: [],
        source: "candidate",
        wipeCandidateSource: true,
      });
    } catch (error) {
      console.error("Error syncing candidate skills metadata:", error);
    }
  };

  const syncSkillsMetadataDiff = async (
    originalSkills: string[],
    currentSkills: string[]
  ) => {
    if (!user?.email) return;

    const originalSet = new Set(originalSkills || []);
    const currentSet = new Set(currentSkills || []);

    const addedSkills = (currentSkills || []).filter(
      (skill) => !originalSet.has(skill)
    );
    const removedSkills = (originalSkills || []).filter(
      (skill) => !currentSet.has(skill)
    );

    if (addedSkills.length === 0 && removedSkills.length === 0) return;

    try {
      await api.post("/api/sync-candidate-skills", {
        candidateEmail: user.email,
        addedSkills,
        removedSkills,
        source: "candidate",
      });
    } catch (error) {
      console.error("Error syncing skills metadata changes:", error);
    }
  };

  const loadSkillsFromMetadata = async () => {
    if (!user?.email) return;

    try {
      const response = await api.get(
        `/api/get-candidate-skills?candidateEmail=${encodeURIComponent(
          user.email
        )}`
      );

      const items = response?.data?.items || [];
      const skillsFromMeta = items
        .map((item: any) => item.skillName)
        .filter((skill: string) => !!skill)
        .slice(0, MAX_SKILLS);

      setSkills(skillsFromMeta);
      setInitialSkills(skillsFromMeta);
    } catch (error) {
      console.error("Error loading candidate skills metadata:", error);
    }
  };

  const handleSkillsChange = (newSkills: string[]) => {
    const limitedSkills = newSkills.slice(0, MAX_SKILLS);
    setSkills(limitedSkills);
    const markdownContent = convertSkillsToMarkdown(limitedSkills);
    setUserCV({
      ...userCV,
      Skills: markdownContent,
    });
    setHasChanges(true);
  };

  function handleClick() {
    if (buildingCV) {
      alert("You can't upload a new file while JIA is building your profile.");
    } else {
      fileInputRef.current.click();
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
  }

  function handleDrop(e) {
    e.preventDefault();

    if (buildingCV) {
      alert("You can't upload a new file while JIA is building your profile.");
    } else {
      handleFile(e.dataTransfer.files);
    }
  }

  function handleEditCV(section) {
    if (file && !userCV) {
      alert(
        "Please upload and submit your file to build your CV before editing."
      );
    } else {
      setEditingCV(section);

      if (section != null) {
        setTimeout(() => {
          const sectionDetails = document.getElementById(section);

          if (sectionDetails) {
            sectionDetails.focus();
          }
        }, 100);
      }
    }
  }

  function handleFile(files) {
    const file = checkFile(files);

    if (file) {
      setDigitalCV(null);
      setEditingCV(null);
      setFile(file);
      setUserCV(null);
      setSkills([]);
    }
  }

  function handleFileChange(e) {
    const files = e.target.files;

    if (files.length > 0) {
      handleFile(files);
    }
  }

  function handleRefresh() {
    if (buildingCV) {
      alert("CV building is in progress. Please wait for it to complete.");
    } else {
      setEditingCV(null);
      setHasChanges(false);
      setLoading(true);
      setRefresh(true);
    }
  }

  async function handleRemoveFile(e) {
    e.stopPropagation();
    e.target.value = "";

    if (buildingCV) {
      alert("You can't remove your file while JIA is building your profile.");
    } else {
      setDigitalCV(null);
      setEditingCV(null);
      setFile(null);
      setUserCV(null);
      setSkills([]);
      if (hasPersistedCV && user?.email) {
        try {
          const response = await api.post("/api/whitecloak/fetch-cv");
          if (response?.data?.digitalCV) {
            const formattedCV = formatCVBySections(response.data.digitalCV || []);
            setDigitalCV(JSON.stringify(response.data));
            setFile(response.data.fileInfo || null);
            setUserCV(formattedCV);
          }
        } catch (error) {
          console.log("No CV found in database");
        }
      }
    }
  }

  useEffect(() => {
    let isMounted = true;

    const loadCVState = async () => {
      let resolvedCV: any = null;

      if (user?.email) {
        try {
          const response = await api.post("/api/whitecloak/fetch-cv");
          if (response?.data?.digitalCV) {
            resolvedCV = response.data;
          }
        } catch (error) {
          console.log("No CV found in database");
        }
      }

      if (!isMounted) return;

      if (resolvedCV) {
        const formattedCV = formatCVBySections(resolvedCV.digitalCV || []);
        setDigitalCV(JSON.stringify(resolvedCV));
        setFile(resolvedCV.fileInfo || null);
        setUserCV(formattedCV);
        setHasPersistedCV(true);
      } else {
        setDigitalCV(null);
        setFile(null);
        setUserCV(null);
        setHasPersistedCV(false);
      }

      await loadSkillsFromMetadata();

      if (!isMounted) return;
      setLoading(false);
      setRefresh(false);
    };

    loadCVState();

    return () => {
      isMounted = false;
    };
  }, [refresh, user?.email]);

  useEffect(() => {
    sessionStorage.setItem("hasChanges", JSON.stringify(hasChanges));
  }, [hasChanges]);

  function handleSaveChanges(skip, userCV) {
    if (editingCV != null && !skip) {
      alert("Please save the changes first.");
      return false;
    }

    const allEmpty = Object.values(userCV).every(
      (value: any) => value.trim() == ""
    );

    if (allEmpty) {
      alert("No details to be save.");
      return false;
    }

    setModalType("loading");

    let parsedDigitalCV = {
      errorRemarks: null,
      digitalCV: null,
    };

    if (digitalCV) {
      parsedDigitalCV = JSON.parse(digitalCV);

      if (parsedDigitalCV.errorRemarks && !hasChanges) {
        alert(
          "Please fix the errors in the CV first.\n\n" +
            parsedDigitalCV.errorRemarks
        );
        return false;
      } else if (hasChanges) {
        parsedDigitalCV.errorRemarks = null;
      }
    }

    const formattedUserCV = cvSections.map((section) => ({
      name: section,
      content: userCV[section]?.trim() || "",
    }));

    parsedDigitalCV.digitalCV = formattedUserCV;

    const data = {
      name: user.name,
      cvData: parsedDigitalCV,
      email: user.email,
      fileInfo: null,
    };

    if (file) {
      data.fileInfo = { name: file.name, size: file.size, type: file.type };
    }

    api.post(`/api/whitecloak/save-cv`, data)
      .then(() => {
        setHasChanges(false);
        setToasterType("manageCV");
        setDigitalCV(JSON.stringify({ ...data, ...data.cvData, fileInfo: data.fileInfo }));
        setHasPersistedCV(true);
        syncSkillsMetadataDiff(initialSkills, skills);
        setInitialSkills(skills);
      })
      .catch((err) => {
        alert("Error saving CV. Please try again.");
        console.log(err);
      })
      .finally(() => {
        setBuildingCV(false);
        setModalType(null);
      });
  }

  function handleSubmit() {
    setBuildingCV(true);
    setHasChanges(true);
    const hasExistingCV = hasPersistedCV;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("fName", file.name);
    formData.append("userEmail", user.email);

    axios({
      method: "POST",
      url: `${CORE_API_URL}/upload-cv`,
      data: formData,
    })
      .then((res) => {
        api.post(`/api/whitecloak/digitalize-cv`, { 
          chunks: res.data.cvChunks
        })
          .then((res) => {
            const result = res.data.result;
            const parsedUserCV = JSON.parse(result);
            const formattedCV = {};

            cvSections.forEach((section, index) => {
              formattedCV[section] =
                parsedUserCV.digitalCV[index].content.trim();
            });

            setDigitalCV(result);
            setUserCV(formattedCV);
            
            // Parse skills from the Skills section, or clear if none
            if (formattedCV["Skills"]) {
              const parsedSkills = parseSkillsFromMarkdown(formattedCV["Skills"]).slice(0, MAX_SKILLS);
              setSkills(parsedSkills);
              setInitialSkills(parsedSkills);
              syncParsedSkillsToMetadata(parsedSkills);
            } else {
              setSkills([]);
              setInitialSkills([]);
            }

            if (!hasExistingCV) {
              handleSaveChanges(true, formattedCV);
            } else {
              setBuildingCV(false);
            }
          })
          .catch((err) => {
            alert("Error building CV. Please try again.");
            setBuildingCV(false);
            console.log(err);
          });
      })
      .catch((err) => {
        alert("Error building CV. Please try again.");
        setBuildingCV(false);
        console.log(err);
      });
  }

  return (
    <div className={styles.manageCV}>
      <div className={styles.textContainer}>
        <span className={styles.name}>Manage CV</span>
        <span className={styles.description}>
          Apply to more jobs in less time by managing your CV here.
        </span>
      </div>

      <div className={styles.cvContainer}>
        <div className={`${styles.gradient} ${styles.maxWidth}`}>
          <div className={styles.cvDetailsCard}>
            <span className={styles.uploadTitle}>
              <div className={styles.uploadIcon}>
                <img alt="" src={assetConstants.upload} />
              </div>
              Upload CV
              <img
                alt=""
                className={styles.refreshIcon}
                src={assetConstants.rotate}
                onClick={handleRefresh}
                onContextMenu={(e) => e.preventDefault()}
                onMouseEnter={() => setIsHover(true)}
                onMouseLeave={() => setIsHover(false)}
              />
              {isHover && (
                <div className={styles.hoverContainer}>
                  <span>Revert your CV to the previous saved version.</span>
                </div>
              )}
            </span>
            <div className={styles.uploadDetailsContainer}>
              {!loading && (
                <>
                  <div
                    className={`${styles.fileUpload} ${
                      file ? styles.uploaded : ""
                    }`}
                    onClick={handleClick}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    {file ? (
                      <div className={styles.uploadedFile}>
                        <img alt="" src={assetConstants.fileV2} />
                        <span>{file.name}</span>({formatFileSize(file.size)} MB)
                        <img
                          alt=""
                          className={styles.xIcon}
                          onClick={handleRemoveFile}
                          onContextMenu={(e) => e.preventDefault()}
                          src={assetConstants.xV2}
                        />
                      </div>
                    ) : (
                      <>
                        <img alt="" src={assetConstants.fileV2} />
                        <span className={styles.uploadFileText}>
                          <span>Click to upload</span> or drag and drop
                        </span>
                        <span className={styles.uploadFileRules}>
                          PDF, DOC, DOCX, or TXT (max 10MB)
                        </span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    style={{ display: "none" }}
                    ref={fileInputRef}
                    onChange={handleFileChange}
                  />
                </>
              )}

              {(buildingCV || loading) && (
                <div className={styles.loadingContainer}>
                  <Image
                    alt=""
                    src={assetConstants.loading}
                    unoptimized
                    width={114}
                    height={90}
                  />
                  {buildingCV && (
                    <>
                      <span className={styles.cvExtract}>
                        Extracting information from your CV...
                      </span>
                      <span className={styles.building}>
                        Jia is building your profile...
                      </span>
                    </>
                  )}
                </div>
              )}

              {!buildingCV && !userCV && !loading && (
                <>
                  <span className={styles.uploadDetails}>
                    Upload your CV and let our AI automatically fill in your
                    profile information.
                  </span>
                  <button
                    className={file ? "" : "disabled"}
                    disabled={!file}
                    onClick={handleSubmit}
                  >
                    Submit
                  </button>
                </>
              )}

              {!buildingCV && userCV && !loading && (
                <>
                  {file && (
                    <span className={styles.cvUploaded}>
                      <img alt="" src={assetConstants.check} />
                      CV Uploaded
                    </span>
                  )}

                  <button
                    className={hasChanges ? "" : "disabled"}
                    disabled={!hasChanges}
                    onClick={() => handleSaveChanges(false, userCV)}
                  >
                    Save Changes
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        <div className={styles.cvDetailsContainer}>
          {cvSections.map((section, index) => (
            <div key={index} className={styles.gradient}>
              <div className={styles.cvDetailsCard}>
                <span className={styles.sectionTitle}>
                  {section}

                  <div className={styles.editIcon}>
                    <img
                      alt=""
                      src={
                        editingCV == section
                          ? assetConstants.save
                          : assetConstants.edit
                      }
                      onClick={() =>
                        handleEditCV(editingCV == section ? null : section)
                      }
                      onContextMenu={(e) => e.preventDefault()}
                    />
                  </div>
                </span>

                <div className={styles.detailsContainer}>
                  {editingCV == section ? (
                    section === "Skills" ? (
                      <SkillTagInput 
                        skills={skills} 
                        onSkillsChange={handleSkillsChange} 
                      />
                    ) : (
                      <Textarea
                        id={section}
                        placeholder="Upload your CV to auto-fill this section."
                        value={userCV && userCV[section] ? userCV[section] : ""}
                        onBlur={(e) =>
                          (e.target.placeholder =
                            "Upload your CV to auto-fill this section.")
                        }
                        onChange={(e) => {
                          setUserCV({
                            ...userCV,
                            [section]: e.target.value,
                          });
                          setHasChanges(true);
                        }}
                        onClick={(e) =>
                          ((e.target as HTMLInputElement).placeholder = "")
                        }
                        onFocus={(e) => (e.target.placeholder = "")}
                      />
                    )
                  ) : (
                    <span
                      className={`${styles.sectionDetails} ${
                        userCV && userCV[section] && userCV[section].trim()
                          ? styles.withDetails
                          : ""
                      }`}
                    >
                      {buildingCV || loading ? (
                        <>
                          <div className={styles.loading} />
                          <div className={styles.loading} />
                        </>
                      ) : section === "Skills" && skills.length > 0 ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {skills.map((skill, index) => (
                            <SkillTag
                              key={index}
                              label={skill}
                            />
                          ))}
                        </div>
                      ) : (
                        <Markdown>
                          {userCV && userCV[section] && userCV[section].trim()
                            ? userCV[section].trim()
                            : "Upload your CV to auto-fill this section."}
                        </Markdown>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
