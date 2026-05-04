import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatInput from "./ChatInput"; 

describe("ChatInput Component", () => {
  const mockSetInput = jest.fn();
  const mockOnSubmit = jest.fn();
  const mockToggleTheme = jest.fn();

  const defaultProps = {
    input: "",
    setInput: mockSetInput,
    onSubmit: mockOnSubmit,
    isLoading: false,
    isDarkMode: true,
    toggleTheme: mockToggleTheme,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the textarea and submit button", () => {
    render(<ChatInput {...defaultProps} />);
    
    expect(screen.getByPlaceholderText("E.g., How does Gojo's infinity work?")).toBeInTheDocument();
    expect(screen.getByRole("button")).toBeInTheDocument();
  });

  it("calls setInput when the user types", async () => {
    const user = userEvent.setup();
    render(<ChatInput {...defaultProps} />);
    
    const textarea = screen.getByPlaceholderText("E.g., How does Gojo's infinity work?");
    await user.type(textarea, "Hello Arbiter");
    
    expect(mockSetInput).toHaveBeenCalled();
  });

  it("disables the submit button when isLoading is true", () => {
    render(<ChatInput {...defaultProps} isLoading={true} />);
    
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    
    const textarea = screen.getByPlaceholderText("E.g., How does Gojo's infinity work?");
    expect(textarea).toBeDisabled();
  });

  it("submits the form when Enter is pressed without Shift", async () => {
    render(<ChatInput {...defaultProps} input="Test message" />);
    
    const textarea = screen.getByPlaceholderText("E.g., How does Gojo's infinity work?");
    
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: false });
    
    expect(mockOnSubmit).toHaveBeenCalledTimes(1);
  });

  it("does NOT submit the form when Shift + Enter is pressed", () => {
    render(<ChatInput {...defaultProps} input="Test message" />);
    
    const textarea = screen.getByPlaceholderText("E.g., How does Gojo's infinity work?");
    
    fireEvent.keyDown(textarea, { key: "Enter", code: "Enter", shiftKey: true });
    
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });
});